"use server";

import { revalidatePath } from "next/cache";
import { cancelShipment, upsertShipment, updateOrderStatus } from "@/lib/data/orders";
import { requireAuthContext, assertAuthorizedVendor } from "@/lib/auth";
import { getServerActionClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ShipmentActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export async function saveShipment(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  const auth = await requireAuthContext();
  const vendorId = auth.vendorId;
  assertAuthorizedVendor(vendorId);

  const supabase = getServerActionClient();

  const shipmentIdRaw = formData.get("shipmentId");
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim();
  const carrier = String(formData.get("carrier") ?? "").trim();
  const status = "shipped";
  const redirectTo = String(formData.get("redirectTo") ?? "/orders");
  const orderId = Number(formData.get("orderId"));

  let lineItemIds = formData
    .getAll("lineItemIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  lineItemIds = Array.from(new Set(lineItemIds));

  const shipmentId = shipmentIdRaw ? Number(shipmentIdRaw) : undefined;

  if ((!shipmentId || lineItemIds.length === 0) && lineItemIds.length === 0) {
    // keep check below but ensures new shipment must have selection
    if (!shipmentId) {
      return {
        status: "error",
        message: "少なくとも1件の明細を選択してください",
      };
    }

    type ShipmentPivot = Pick<
      Database["public"]["Tables"]["shipment_line_items"]["Row"],
      "line_item_id"
    >;
    const { data: existing, error: existingError } = await supabase
      .from("shipment_line_items")
      .select("line_item_id")
      .eq("shipment_id", shipmentId)
      .returns<ShipmentPivot[]>();

    if (existingError) {
      console.error("Failed to load shipment line items", existingError);
      return { status: "error", message: "関連する明細の取得に失敗しました" };
    }

    lineItemIds = (existing ?? []).map((entry) => entry.line_item_id);
  }

  if (!shipmentId && lineItemIds.length === 0) {
    return {
      status: "error",
      message: "少なくとも1件の明細を選択してください",
    };
  }

  const { data: orderMeta, error: orderMetaError } = await supabase
    .from("orders")
    .select("archived_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderMetaError) {
    console.error("Failed to verify order archive status", orderMetaError);
    return { status: "error", message: "注文情報の取得に失敗しました" };
  }

  if (orderMeta?.archived_at) {
    return {
      status: "error",
      message: "Shopify 側でアーカイブ済みの注文のため、発送登録はできません",
    };
  }

  if (trackingNumber.length === 0) {
    return { status: "error", message: "追跡番号を入力してください" };
  }

  try {
    await upsertShipment(
      {
        id: shipmentId,
        lineItemIds,
        trackingNumber,
        carrier,
        status,
      },
      vendorId,
    );

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");

    if (redirectTo && redirectTo !== `/orders/${orderId}`) {
      revalidatePath(redirectTo);
    }

    return { status: "success", message: "配送情報を保存しました" };
  } catch (error) {
    console.error("Failed to save shipment", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "配送情報の保存に失敗しました。入力内容を確認してください。",
    };
  }
}

export async function changeOrderStatus(orderId: number, status: string) {
  const auth = await requireAuthContext();
  const vendorId = auth.vendorId;
  assertAuthorizedVendor(vendorId);

  await updateOrderStatus(orderId, status, vendorId);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function cancelShipmentAction(
  _prevState: ShipmentActionState,
  formData: FormData,
): Promise<ShipmentActionState> {
  const auth = await requireAuthContext();
  const vendorId = auth.vendorId;
  assertAuthorizedVendor(vendorId);

  const orderId = Number(formData.get("orderId"));
  const shipmentId = Number(formData.get("shipmentId"));
  const redirectTo = String(formData.get("redirectTo") ?? "/orders");
  const reasonTypeRaw = formData.get("reasonType");
  const reasonDetailRaw = formData.get("reasonDetail");

  const reasonType = typeof reasonTypeRaw === "string" ? reasonTypeRaw.trim() : "";
  const reasonDetail = typeof reasonDetailRaw === "string" ? reasonDetailRaw.trim() : "";

  if (!Number.isInteger(orderId) || !Number.isInteger(shipmentId)) {
    return {
      status: "error",
      message: "発送情報の指定が正しくありません",
    };
  }

  if (!reasonType) {
    return {
      status: "error",
      message: "取消理由を選択してください",
    };
  }

  if (reasonType === "other" && reasonDetail.length === 0) {
    return {
      status: "error",
      message: "その他を選択した場合は理由を入力してください",
    };
  }

  try {
    await cancelShipment(shipmentId, vendorId, {
      reasonType,
      reasonDetail: reasonType === "other" ? reasonDetail : null,
    });

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");

    if (redirectTo && redirectTo !== `/orders/${orderId}`) {
      revalidatePath(redirectTo);
    }

    return {
      status: "success",
      message: "発送を未発送に戻しました",
    };
  } catch (error) {
    console.error("Failed to cancel shipment", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "発送を未発送に戻す処理でエラーが発生しました",
    };
  }
}

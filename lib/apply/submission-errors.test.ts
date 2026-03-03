import {
  APPLY_DUPLICATE_EMAIL_MESSAGE,
  APPLY_GENERIC_ERROR_MESSAGE,
  APPLY_PENDING_APPLICATION_MESSAGE,
  resolveApplySubmissionErrorMessage,
  resolveApplySubmissionFieldErrors
} from './submission-errors';

describe('resolveApplySubmissionFieldErrors', () => {
  it('maps duplicate email conflicts to the contactEmail field', () => {
    expect(resolveApplySubmissionFieldErrors(APPLY_DUPLICATE_EMAIL_MESSAGE)).toEqual({
      contactEmail: APPLY_DUPLICATE_EMAIL_MESSAGE
    });
  });

  it('maps pending application conflicts to the contactEmail field', () => {
    expect(resolveApplySubmissionFieldErrors(APPLY_PENDING_APPLICATION_MESSAGE)).toEqual({
      contactEmail: APPLY_PENDING_APPLICATION_MESSAGE
    });
  });

  it('returns null for generic failures', () => {
    expect(resolveApplySubmissionFieldErrors(APPLY_GENERIC_ERROR_MESSAGE)).toBeNull();
  });
});

describe('resolveApplySubmissionErrorMessage', () => {
  it('normalizes pending application errors', () => {
    expect(
      resolveApplySubmissionErrorMessage(
        new Error(`prefix: ${APPLY_PENDING_APPLICATION_MESSAGE}`)
      )
    ).toBe(APPLY_PENDING_APPLICATION_MESSAGE);
  });

  it('normalizes duplicate key errors to the duplicate email message', () => {
    expect(
      resolveApplySubmissionErrorMessage(
        new Error('duplicate key value violates unique constraint "users_email_key"')
      )
    ).toBe(APPLY_DUPLICATE_EMAIL_MESSAGE);
  });

  it('falls back to the generic apply error message', () => {
    expect(resolveApplySubmissionErrorMessage(new Error('unexpected'))).toBe(
      APPLY_GENERIC_ERROR_MESSAGE
    );
  });
});

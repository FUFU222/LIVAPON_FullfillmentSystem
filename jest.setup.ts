import '@testing-library/jest-dom';

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    cache: actual.cache ?? ((fn: unknown) => fn)
  };
});

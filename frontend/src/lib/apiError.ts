/** Extract a user-facing error message from an Axios error response. */
export function getApiError(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? 'An unexpected error occurred'
  );
}

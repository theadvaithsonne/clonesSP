/**
 * Shared error type for the third-party (partner API) surface.
 *
 * Lives in its own module so pure modules like `thirdPartyTerms.ts` can throw it
 * without importing `thirdPartyInvoice.ts` — which transitively pulls in the
 * invoice service and the Razorpay client. That import would also be circular,
 * since `thirdPartyInvoice.ts` needs `thirdPartyTerms.ts` for term pricing.
 */
export class ThirdPartyError extends Error {
  code: string;
  statusCode: number;
  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

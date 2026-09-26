export function GET() {
  return Response.json({ status: "ok", secIdentity: !!process.env.SEC_USER_AGENT, fredKey: !!process.env.FRED_API_KEY });
}

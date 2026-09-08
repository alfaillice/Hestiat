import { NextResponse } from "next/server";
import { openai } from "../../../../../src/server/lib/openai";

export async function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json({
    provider: "openai",
    configured,
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    responsesApi: true,
    status: configured && openai ? "configured" : "missing_api_key",
  }, { status: configured && openai ? 200 : 503 });
}

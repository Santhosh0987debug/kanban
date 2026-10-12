import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(resource = "Resource") {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(err: unknown) {
  console.error(err);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

export function zodError(err: ZodError) {
  return NextResponse.json(
    { error: "Validation failed", issues: err.flatten().fieldErrors },
    { status: 400 }
  );
}

export function assertObjectId(id: string): boolean {
  return isValidObjectId(id);
}

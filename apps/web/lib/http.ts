import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: error.flatten()
      },
      {
        status: 400
      }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message
      },
      {
        status: 400
      }
    );
  }

  return NextResponse.json(
    {
      error: "unexpected_error"
    },
    {
      status: 500
    }
  );
}

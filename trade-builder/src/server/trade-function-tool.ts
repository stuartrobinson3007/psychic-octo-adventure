import { FunctionTool } from "@google/adk"
import type { ToolOptions } from "@google/adk"
import { z } from "zod"

/** Preserve the original JSON Schema for providers whose dialect differs from Gemini's. */
export class TradeFunctionTool<
  TParameters extends z.ZodObject,
> extends FunctionTool<TParameters> {
  readonly jsonSchema: Record<string, unknown>

  constructor(options: ToolOptions<TParameters> & { parameters: TParameters }) {
    super(options)
    this.jsonSchema = z.toJSONSchema(options.parameters)
  }
}

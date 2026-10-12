import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Marker, MarkerIcon, MarkerContent } from "@/components/ui/marker"
import { Spinner } from "@/components/ui/spinner"
import { AlertCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import {
  currentToolActivity,
  completedToolActivities,
  workDurationLabel,
} from "@/lib/tool-activity"
import type { ToolActivity } from "@/lib/trade/types"
import { Icon } from "./icons"

export function CurrentToolActivity({ calls }: { calls: Array<ToolActivity> }) {
  const current = currentToolActivity(calls)
  return (
    <Marker role="status">
      <MarkerIcon>
        <Spinner />
      </MarkerIcon>
      <MarkerContent>
        {current?.activeLabel ?? current?.label ?? "Working…"}
      </MarkerContent>
    </Marker>
  )
}

export function ToolCallHistory({
  calls,
  workDurationMs,
  payrollScenario = false,
}: {
  calls?: Array<ToolActivity>
  workDurationMs?: number
  payrollScenario?: boolean
}) {
  const visible = completedToolActivities(calls)
  if (!visible.length) return null
  return (
    <Accordion
      data-tool-history
      defaultValue={[]}
      className="max-w-full border-b border-border/70 pb-2"
    >
      <AccordionItem value="steps">
        <AccordionTrigger className="w-fit flex-none items-center gap-2 py-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:no-underline">
          {workDurationLabel(workDurationMs)}
        </AccordionTrigger>
        <AccordionContent className="pb-1">
          <ol
            role="list"
            className="mt-2 flex flex-col gap-2 border-l border-border py-1 pl-3 text-xs text-muted-foreground"
          >
            {visible.map((call) => (
              <li key={call.id} className="flex items-start gap-2">
                <Icon
                  icon={call.state === "error" ? AlertCircleIcon : Tick02Icon}
                  className="size-3.5 shrink-0"
                />
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  {payrollScenario && call.label === "Checked the trade"
                    ? "Calculated payroll"
                    : call.label.replace("a hypothetical signing", "signing")}
                  {call.details?.map((detail, index) => (
                    <p key={index} className="mt-1 max-w-[65ch] text-pretty">
                      {detail}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { presentTradeAllowance } from "@/lib/trade-allowance"
import type { TradeVerdict } from "@/lib/trade/types"

function AllowanceList({ allowances }: { allowances: Array<string> }) {
  return (
    <ul
      role="list"
      className="salary-explanations flex min-w-0 flex-col gap-4 border-l border-foreground/25 pl-4 text-base leading-body sm:text-sm"
    >
      {allowances.map((allowance, index) => {
        const explanation = presentTradeAllowance(allowance)
        return (
          <li key={index} className="flex min-w-0 flex-col gap-1.5">
            {explanation.kind === "exception" && (
              <h5 className="text-sm font-medium text-balance text-foreground">
                Expanded TPE
              </h5>
            )}
            <p
              className={`max-w-[65ch] min-w-0 text-pretty [overflow-wrap:anywhere] ${explanation.kind === "note" ? "text-muted-foreground" : ""}`}
            >
              {explanation.text}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export function TradeSalaryRules({ verdict }: { verdict: TradeVerdict }) {
  const explainedTeams = verdict.teams.filter(
    (team) => team.allowances.length > 0
  )

  if (!explainedTeams.length && !verdict.appliedRules.length) return null

  return (
    <Accordion>
      <AccordionItem value="salary-rules">
        <AccordionTrigger className="items-center gap-3 bg-muted/40 px-4 py-3 transition-colors hover:bg-muted hover:no-underline">
          Salary rules
        </AccordionTrigger>
        <AccordionContent className="px-4 pt-3">
          <div className="flex flex-col gap-5">
            {explainedTeams.length > 0 && (
              <div className="flex flex-col divide-y divide-border">
                {explainedTeams.map((evidence) => (
                  <section
                    key={evidence.teamId}
                    aria-label={`${evidence.teamName} salary rules`}
                    className="flex min-w-0 flex-col gap-3 py-5 first:pt-0 last:pb-0"
                  >
                    <h4 className="text-base font-semibold text-balance">
                      {evidence.teamName}
                    </h4>
                    <AllowanceList allowances={evidence.allowances} />
                  </section>
                ))}
              </div>
            )}
            {verdict.appliedRules.length > 0 && (
              <Accordion className="rounded-lg bg-muted/40">
                <AccordionItem value="rule-details">
                  <AccordionTrigger className="items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground transition-colors hover:bg-muted hover:no-underline">
                    Rule details
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2">
                    <ul
                      role="list"
                      className="salary-rule-details flex flex-col gap-4 text-base leading-body text-muted-foreground sm:text-sm"
                    >
                      {verdict.appliedRules.map((rule, index) => (
                        <li
                          key={index}
                          className="text-pretty [overflow-wrap:anywhere]"
                        >
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

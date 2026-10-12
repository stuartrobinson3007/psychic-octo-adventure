import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TeamMark } from "./team-mark"
import type { Team } from "@/lib/trade/types"

export function TeamFilter({
  teams,
  value,
  onChange,
  name = "team-filter",
  label = "Filter by team",
  caption,
}: {
  teams: Array<Team>
  value: string
  onChange: (value: string) => void
  name?: string
  label?: string
  caption?: string
}) {
  const items = useMemo(
    () => [
      { value: "", label: "All teams", team: undefined },
      ...teams.map((team) => ({
        value: String(team.id),
        label: `${team.city ?? ""} ${team.name}`.trim(),
        team,
      })),
    ],
    [teams]
  )
  const selected = items.find((item) => item.value === value) ?? items[0]
  return (
    <Field className={caption ? "min-w-0 flex-1 gap-1" : "min-w-0 flex-1"}>
      <FieldLabel
        htmlFor={name}
        className={
          caption ? "text-xs font-normal text-muted-foreground" : "sr-only"
        }
      >
        {caption ?? label}
      </FieldLabel>
      <Combobox<(typeof items)[number]>
        name={name}
        items={items}
        value={selected}
        onValueChange={(item) => onChange(item?.value ?? "")}
        isItemEqualToValue={(item, selectedItem) =>
          item.value === selectedItem.value
        }
        filter={(item, query) =>
          `${item.label} ${item.team?.abbreviation ?? ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        }
        autoHighlight
      >
        <ComboboxTrigger
          id={name}
          aria-label={label}
          render={<Button variant="outline" size="sm" />}
          className="w-full justify-between"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected.team && <TeamMark team={selected.team} size="compact" />}
            <span className="truncate">{selected.label}</span>
          </span>
        </ComboboxTrigger>
        <ComboboxContent className="min-w-(--anchor-width)">
          <ComboboxInput
            placeholder="Search teams…"
            aria-label="Search teams"
            showTrigger={false}
          />
          <ComboboxEmpty>No teams found.</ComboboxEmpty>
          <ScrollArea
            className="max-h-60"
            viewportRender={
              <ComboboxList role="listbox" className="max-h-60" />
            }
          >
            <ComboboxGroup>
              <ComboboxCollection>
                {(item: (typeof items)[number]) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.team && <TeamMark team={item.team} />}
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          </ScrollArea>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}

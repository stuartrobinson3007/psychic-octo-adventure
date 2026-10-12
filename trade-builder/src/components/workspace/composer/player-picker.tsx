import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  HashtagIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Icon } from "@/components/workspace/icons"
import { TeamMark } from "@/components/workspace/team-mark"
import { PlayerAvatar } from "@/components/workspace/player-avatar"
import { useCatalogue } from "@/components/workspace/research-context"
import { money, normalizeName, searchPlayers } from "@/lib/player-research"
import { searchDraftPicks, pickUnavailableReason } from "@/lib/pick-research"
import { pickLabel, pickDetails } from "@/lib/trade/picks"
import type { DraftPick, Player, Team } from "@/lib/trade/types"

export function PlayerPicker({
  open,
  onOpen,
  onClose,
  onSelect,
  onSelectPick,
  selectedPickIds,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (player: Player) => void
  onSelectPick: (pick: DraftPick) => void
  selectedPickIds: Array<number>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const catalogue = useCatalogue()
  const [query, setQuery] = useState("")
  const [team, setTeam] = useState<Team | null>(null)
  const [tab, setTab] = useState("players")
  useEffect(() => {
    if (open) {
      setQuery("")
      setTeam(null)
      setTab("players")
    }
  }, [open])
  const players = useMemo(
    () =>
      searchPlayers(
        catalogue.players.filter((player) =>
          team ? player.teamId === team.id : player.teamId > 0
        ),
        query
      )
        .sort((a, b) => (!query ? b.salary - a.salary : 0))
        .slice(0, 30),
    [catalogue, query, team]
  )
  const teams =
    team || !query.trim()
      ? []
      : catalogue.teams
          .filter((item) =>
            normalizeName(
              `${item.city ?? ""}${item.name}${item.abbreviation}`
            ).includes(normalizeName(query))
          )
          .slice(0, 4)
  const picks = useMemo(
    () =>
      searchDraftPicks(catalogue, {
        query,
        owner: "",
        origin: "",
        year: "",
        round: "",
        availability: "",
        sort: "year",
      }).slice(0, 30),
    [catalogue, query]
  )
  return (
    <Popover open={open} onOpenChange={(next) => (next ? onOpen() : onClose())}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Find a player or draft pick"
            onMouseDown={(event) => event.preventDefault()}
          />
        }
      >
        <Icon icon={HashtagIcon} data-icon="inline-start" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <PopoverTitle className="sr-only">
          Find a player or draft pick
        </PopoverTitle>
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(String(value))
            setQuery("")
            setTeam(null)
          }}
          className="gap-0"
        >
          <TabsList className="mx-2 mt-2 w-auto" aria-label="Asset type">
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="picks">Draft picks</TabsTrigger>
          </TabsList>
          <TabsContent value="players">
            <Command shouldFilter={false}>
              <div className="flex items-center gap-1 p-1">
                {team && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Back to teams and players"
                    onClick={() => {
                      setTeam(null)
                      setQuery("")
                      inputRef.current?.focus()
                    }}
                  >
                    <Icon icon={ArrowLeft01Icon} data-icon="inline-start" />
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                  <CommandInput
                    ref={inputRef}
                    autoFocus
                    value={query}
                    onValueChange={setQuery}
                    placeholder={
                      team
                        ? `Search ${team.abbreviation} players`
                        : "Search teams or players"
                    }
                    aria-label="Search teams or players"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close player search"
                  onClick={onClose}
                >
                  <Icon icon={Cancel01Icon} data-icon="inline-start" />
                </Button>
              </div>
              <CommandList>
                <CommandEmpty>No matches. Try a surname or team.</CommandEmpty>
                {teams.length > 0 && (
                  <CommandGroup heading="Teams">
                    {teams.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`team-${item.id}`}
                        onSelect={() => {
                          setTeam(item)
                          setQuery("")
                          inputRef.current?.focus()
                        }}
                      >
                        <TeamMark team={item} />
                        <span className="flex-1">
                          {item.city} {item.name}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandGroup
                  heading={team ? `${team.name} roster` : "Players"}
                >
                  {players.map((player) => (
                    <CommandItem
                      key={player.id}
                      value={`player-${player.id}`}
                      onSelect={() => onSelect(player)}
                    >
                      <PlayerAvatar player={player} />
                      <div className="min-w-0 flex-1">
                        <div>{player.name}</div>
                        <div className="text-muted-foreground">
                          {player.signingStatus === "free-agent" ? "FA" : catalogue.teams.find(
                            (item) => item.id === player.teamId
                          )?.abbreviation ?? "FA"}{" "}
                          · {player.position ?? "Player"}
                        </div>
                      </div>
                      <span className="text-muted-foreground tabular-nums">
                        {money(player.salary)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>
          <TabsContent value="picks">
            <Command shouldFilter={false}>
              <div className="flex items-center gap-1 p-1">
                <div className="min-w-0 flex-1">
                  <CommandInput
                    autoFocus
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search teams, years or rounds"
                    aria-label="Search draft picks"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close draft pick search"
                  onClick={onClose}
                >
                  <Icon icon={Cancel01Icon} data-icon="inline-start" />
                </Button>
              </div>
              <CommandList>
                <CommandEmpty>No matching draft picks.</CommandEmpty>
                <CommandGroup>
                  {picks.map((pick) => {
                    const unavailable = pickUnavailableReason(pick)
                    const inMessage = selectedPickIds.includes(pick.id)
                    const owner = catalogue.teams.find(
                      (item) => item.id === pick.currentTeamId
                    )
                    return (
                      <CommandItem
                        key={pick.id}
                        value={`pick-${pick.id}`}
                        disabled={!!unavailable || inMessage}
                        onSelect={() => onSelectPick(pick)}
                        title={unavailable ?? undefined}
                      >
                        <TeamMark team={owner} />
                        <div className="min-w-0 flex-1">
                          <div>{pickLabel(pick, catalogue)}</div>
                          <div className="text-muted-foreground">
                            Owned by {owner?.abbreviation ?? pick.currentTeamId}
                            {" · "}
                            {inMessage
                              ? "In message"
                              : unavailable
                                ? "Unavailable"
                                : pickDetails(pick)}
                          </div>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

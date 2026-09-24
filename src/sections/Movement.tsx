import { useMemo } from 'react'
import type { Derived } from '../hooks/useDerived'
import { MissingSource } from '../components/MissingSource'
import { BarList, Card, Grid, Stat, StatGrid } from '../components/ui'
import { ColumnChart, StackedColumns } from '../components/charts'
import { useStore } from '../store/useStore'
import { CO2_PER_KM, MODE_LABEL } from '../lib/stats'
import { fmtDate, fmtDuration, fmtKm, fmtNum, fmtNum1, WEEKDAYS } from '../lib/format'
import { EARTH_CIRCUMFERENCE_KM } from '../lib/geo'
import type { TravelMode } from '../types'

export function Movement({ d }: { d: Derived }) {
  const { mStats: m, tl } = d
  const select = useStore((s) => s.select)

  const ground = m.list.filter((x) => x.mode !== 'flying')
  const stacked = useMemo(() => {
    const top = ground
      .filter((x) => x.mode !== 'unknown')
      .slice(0, 5)
      .map((x) => x.mode)
    const rows = [...m.byYear.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([y, r]) => {
        const row: Record<string, number | string> = { label: y }
        let other = 0
        for (const [mode, km] of Object.entries(r)) {
          if (mode === 'flying') continue
          if (top.includes(mode as TravelMode)) row[mode] = Math.round(km)
          else other += km
        }
        row.other = Math.round(other)
        return row
      })
    const labels: Record<string, string> = { other: 'Other' }
    top.forEach((k) => (labels[k] = MODE_LABEL[k]))
    return { rows, keys: [...top, 'other'], labels }
  }, [m.byYear, ground])

  if (!tl) {
    return (
      <Card>
        <MissingSource>
          Movement stats come from Google Timeline — import it to see how you get around.
        </MissingSource>
      </Card>
    )
  }
  const walking = m.list.find((x) => x.mode === 'walking')
  const hours = ground.reduce((a, b) => a + b.hours, 0)
  const co2Items = [
    ...ground
      .filter((x) => CO2_PER_KM[x.mode])
      .map((x) => ({
        key: x.mode,
        label: MODE_LABEL[x.mode],
        value: (CO2_PER_KM[x.mode] ?? 0) * x.km,
      })),
    { key: 'flights', label: 'Flights (Flighty)', value: m.flightKm * (CO2_PER_KM.flying ?? 0) },
  ]
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((x) => ({ ...x, display: `${fmtNum(x.value)} kg` }))

  return (
    <div className="space-y-4">
      <StatGrid max={4}>
        <Stat
          label="Ground distance"
          value={fmtKm(m.groundKm)}
          hint={`${fmtNum1(m.groundKm / EARTH_CIRCUMFERENCE_KM)}× around the Earth`}
        />
        <Stat
          label="Walked"
          value={fmtKm(walking?.km ?? 0)}
          hint={`${fmtNum((walking?.km ?? 0) / 42.195)} marathons`}
        />
        <Stat
          label="Time on the move"
          value={`${fmtNum(hours / 24)} days`}
          hint={`${fmtNum(hours)} hours on the ground`}
        />
        <Stat label="CO₂e estimate" value={`${fmtNum1(m.co2 / 1000)} t`} hint="incl. flights" />
      </StatGrid>

      <Grid>
        <Card title="Distance by mode">
          <BarList
            limit={12}
            items={m.list.map((x) => ({
              key: x.mode,
              label: MODE_LABEL[x.mode],
              value: x.km,
              display: `${fmtKm(x.km)} · ${fmtDuration(x.hours * 60)}`,
            }))}
          />
        </Card>
        <Card title="Longest single journeys" subtitle="Click to see where it ended">
          <ul className="divide-y divide-line text-sm">
            {m.list
              .filter((x) => x.longest && x.mode !== 'unknown')
              .slice(0, 8)
              .map((x) => (
                <li key={x.mode}>
                  <button
                    className="flex w-full items-center gap-2 py-2 text-left hover:text-accent"
                    onClick={() =>
                      select({
                        type: 'point',
                        lat: x.longest!.b[0],
                        lon: x.longest!.b[1],
                        label: MODE_LABEL[x.mode],
                      })
                    }
                  >
                    <span className="w-20 shrink-0 text-ink-3">{MODE_LABEL[x.mode]}</span>
                    <span className="flex-1 whitespace-nowrap text-ink-2">
                      {fmtDate(x.longest!.s)}
                    </span>
                    <span className="tabular font-medium">{fmtKm(x.longest!.km)}</span>
                    <span className="tabular w-16 text-right text-xs text-ink-3">
                      {fmtDuration((x.longest!.e - x.longest!.s) / 60000)}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      </Grid>

      <Card title="Ground distance per year" subtitle="km by mode of transport">
        <StackedColumns
          data={stacked.rows}
          keys={stacked.keys}
          labels={stacked.labels}
          format={(v) => fmtNum(v)}
          height={260}
        />
      </Card>

      <Grid>
        <Card title="Which days you move most" subtitle="Ground km by weekday">
          <ColumnChart
            data={m.weekday.map((v, i) => ({ label: WEEKDAYS[i], value: Math.round(v) }))}
            valueLabel="km"
            format={(v) => fmtNum(v)}
            height={170}
          />
        </Card>
        <Card
          title="Estimated CO₂e by mode"
          subtitle="Rough average factors per passenger-km — for perspective, not accounting"
        >
          <BarList items={co2Items} />
        </Card>
      </Grid>
    </div>
  )
}

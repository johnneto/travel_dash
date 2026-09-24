# Travel Dash

A personal travel dashboard that turns your **Google Maps Timeline** export and your **Flighty** flight log into an interactive 3D globe and a set of insights about the countries, cities and places you've been.

Everything runs in the browser. Imported files are parsed locally (in a Web Worker) and stored in IndexedDB. Nothing is uploaded, and no personal data is ever committed to this repo.

## Features

- **3D interactive globe** ([globe.gl](https://github.com/vasturiano/react-globe.gl)): visited countries shaded by days spent, flight arcs, city markers. The camera flies to whatever you select: a country, city, airport, route, flight or trip. Selecting a trip traces your path.
- **Global filters**: a time period (all time, last 12 months, any year, custom range) and a country. A year bar above every section switches between _All time_ and each year with one click. Every section, fact and globe layer updates to match.
- **Overview**: headline KPIs, a _Did you know?_ list of facts that changes with the filters, travel per year, countries discovered over time, and continent coverage.
- **Places**: a search across every city and place in your Timeline (by city, country, continent or place type such as Home or Work, accent-insensitive), a sortable country table (days, trips, cities, first and last visit), top cities, most visited places (with Google Maps links), the geographic extremes, and a history of where you lived.
- **Flights**: records (longest and shortest by distance and by time, fastest, most delayed, longest taxi, biggest time-zone jump), aircraft, airlines, manufacturers, airports, routes, repeat tail numbers, punctuality, departure hour and weekday, seat and cabin, upcoming flights, and a searchable flight log.
- **Trips**: trips detected automatically, a month × year heatmap of days away, trip-length and start-day distributions, and a trip list.
- **Movement**: distance and time by transport mode, longest single journeys, km per year by mode, weekday patterns, and a CO₂e estimate.
- **Timeline × Flighty cross-reference**
  - Each flight is checked against the Timeline: _confirmed_ (Google recorded a flight segment), _at airport_ (a visit at the airport) or _mismatch_.
  - How early you typically get to the airport, and how long it takes you to leave after landing.
  - **Flights Google saw that are missing from Flighty**, with the nearest airports inferred.
  - Flights are attached to the trips they belong to.
- **Profiles**: separate datasets per person, switchable from the header.
- Responsive layout (phone to ultrawide), with light, dark and system themes.

## Importing data

Click **Import** and drop one or both files. Either source on its own is enough: with only Flighty you get flight stats, countries and routes; with only the Timeline you get places, trips, movement and the flights Google recorded. Sections that need the missing source say so and link to the import. A newly imported file replaces the existing data of the same type.

### Profiles

Use the profile menu in the header to keep separate datasets, for example one per traveller. Each profile stores its own imported files, and filters reset when you switch. You can create, rename and delete profiles. Deleting one removes its data from the browser. An import that is still running finishes into the profile it started in, even if you switch away.

| Source               | How to export                                                          | Format                                                                                       |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Flighty              | Flighty app → Settings → Export flight data                            | CSV (`FlightyExport-YYYY-MM-DD.csv`)                                                         |
| Google Maps Timeline | Google Maps app → Settings → Location & privacy → Export Timeline data | JSON. Both the iOS (array) and Android (`semanticSegments`) on-device exports are supported. |

### How the Timeline is interpreted

- **Reverse geocoding** runs offline. Each location maps to the most representative nearby GeoNames city (a population-weighted nearest-neighbour search) and to a country via Natural Earth polygons.
- **Home** is detected month by month from `Home` / `Inferred Home` visits. If there are no such labels, the fallback is where you spend your nights.
- A **trip** is a run of days on which you were more than 100 km from home (gaps of up to 2 days without data are bridged).
- **Days per country** are calendar days with any presence in that country. Path points recorded mid-flight, or moving at airliner speed, are ignored so overflown countries don't count.
- Flight times from Flighty are local times, converted to UTC with each airport's IANA time zone.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest unit tests (parsers, geo, processing, cross-reference)
npm run lint       # oxlint
npm run typecheck
npm run build      # production build in dist/
npm run refdata    # regenerate public/data/* reference datasets
```

Requires Node 20+.

### Project structure

```
public/data/            Public reference data (generated by scripts/build-refdata.mjs)
scripts/                Reference-data build script
src/
  lib/parsers/          Flighty CSV + Google Timeline JSON parsers
  lib/process/          Timeline processing: geocoding, days, homes, trips
  lib/geocoder.ts       Offline reverse geocoder (kdbush + point-in-polygon)
  lib/cross.ts          Flights × Timeline cross-reference
  lib/stats.ts          Filtering and all aggregate statistics
  lib/insights.ts       "Did you know?" fact generator
  worker/               Import Web Worker
  store/                Zustand store + IndexedDB persistence
  components/           Globe, header, import dialog, charts, UI primitives
  sections/             Overview, Places, Flights, Trips, Movement
```

### Reference data and licences

- Cities: [GeoNames](https://www.geonames.org/), via `all-the-cities` (CC BY 4.0)
- Country shapes: [Natural Earth](https://www.naturalearthdata.com/), via `world-atlas` (public domain)
- Country metadata: `world-countries` (ODbL)
- Airports: [mwgg/Airports](https://github.com/mwgg/Airports) (MIT)
- Airlines: [OpenFlights](https://openflights.org/data.html) (ODbL)

## Deployment

The app is a static site. `.github/workflows/deploy.yml` publishes it to GitHub Pages on every push to `main`. To enable it, set **Settings → Pages → Source** to _GitHub Actions_. Since the data lives in each visitor's browser, a public deployment exposes none of your travel history.

# U.S. place data

`us-census-places-2026.json` is a normalized, offline derivative of the U.S. Census Bureau 2026 National Places Gazetteer file. It includes incorporated places and census-designated places in all 50 states and Washington, D.C.; Puerto Rico was intentionally excluded because this feature standardizes to the requested 50-state-plus-D.C. USPS set.

Source: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip

Place-type suffixes such as `city`, `town`, `village`, `borough`, and `CDP` were removed for matching. Each normalized place name retains every associated USPS state code so ambiguous names are never resolved by guesswork.

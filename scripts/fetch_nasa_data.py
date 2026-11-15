"""Download and reduce the real NASA data used by the monitor. Run from the project root:

    python3 scripts/fetch_nasa_data.py

Sources (public, no key):
- NASA OSDR RadLab Data API: ISS DOSTEL absorbed dose rate, 2022-04-01 .. 2022-04-08
- NASA CCMC DONKI: solar energetic particle (SEP) events, 2022-03-25 .. 2022-04-10
Output: src/data/radlab_dostel.json (5-minute means of DosTel1) and src/data/donki_sep.json.
"""
import csv, io, json, subprocess, urllib.parse
from collections import defaultdict
from datetime import datetime, timezone

RADLAB = "https://visualization.osdr.nasa.gov/radlab/api/"
RADLAB_QUERY = ["spacecraft=ISS", "instrument=DosTel", "timestamp>=2022-04-01T00:00", "timestamp<2022-04-08T00:00", "absorbed_dose_rate", "format=tsv"]
DONKI = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2022-03-25&endDate=2022-04-10"
INSTRUMENT, BIN_MIN = "DosTel1", 5


def get(url):
    return subprocess.run(["curl", "-sL", "-m", "120", "-A", "Mozilla/5.0", url], check=True, capture_output=True, text=True).stdout


def main():
    url = RADLAB + "?" + "&".join(urllib.parse.quote(q, safe="=") for q in RADLAB_QUERY)
    bins = defaultdict(list)
    for r in csv.DictReader(io.StringIO(get(url)), delimiter="\t"):
        if r["instrument_id"] != INSTRUMENT:
            continue
        t = datetime.fromisoformat(r["timestamp"]).replace(tzinfo=timezone.utc).timestamp()
        bins[int(t // (BIN_MIN * 60))].append(float(r["absorbed_dose_rate"]))
    points = [[b * BIN_MIN * 60 * 1000, round(sum(v) / len(v), 3)] for b, v in sorted(bins.items())]
    json.dump({
        "source": "NASA Open Science Data Repository (OSDR) RadLab Data API",
        "url": url,
        "spacecraft": "ISS", "instrument": INSTRUMENT, "quantity": "absorbed dose rate", "unit": "µGy/h",
        "unitNote": "Unit as given in the team's data bibliography for RadLab dose rate; confirm against the RadLab portal before publishing numbers.",
        "processing": f"{BIN_MIN}-minute means of the raw samples; no other change",
        "retrieved": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "points": points,
    }, open("src/data/radlab_dostel.json", "w"), ensure_ascii=False)
    events = [{"time": e["eventTime"], "instruments": [i["displayName"] for i in e["instruments"]], "link": e["link"]} for e in json.loads(get(DONKI))]
    json.dump({
        "source": "NASA CCMC DONKI (Space Weather Database Of Notifications, Knowledge, Information)",
        "url": DONKI, "retrieved": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "events": events,
    }, open("src/data/donki_sep.json", "w"), ensure_ascii=False, indent=1)
    print(len(points), "RadLab points;", len(events), "DONKI SEP events")


main()

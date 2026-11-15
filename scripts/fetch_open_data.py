"""Download, verify and reduce the open datasets named in the team documents. Run from the project root:

    python3 scripts/fetch_open_data.py

Raw files go to data/raw/<source>/ (git-ignored) with a manifest (date, SHA-256). Reduced JSON goes to src/data/.
Sources (public, no key):
- PhysioNet MMASH 1.0.0: sleep (TST) and night-time rMSSD of healthy adults
- NASA OSDR OSD-569 (CBC) and OSD-575 (CMP): Inspiration4 crew blood values before, during and after flight
- NOAA SWPC GOES integral protons, 7 days (>=10 MeV flux, S-scale context)
- npj Microgravity Sprint papers + supplementary tables (exercise prescription; kept raw only)
"""
import csv, hashlib, io, json, os, statistics as st, subprocess, zipfile
from collections import defaultdict
from datetime import datetime, timezone

RAW = "data/raw"
OUT = "src/data"
UA = "Mozilla/5.0"
FILES = {
    "mmash": [("https://physionet.org/files/mmash/1.0.0/" + f, f) for f in ("MMASH.zip", "LICENSE.txt", "SHA256SUMS.txt")],
    "osdr": [
        ("https://osdr.nasa.gov/geode-py/ws/studies/OSD-569/download?source=datamanager&file=LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv", "LSDS-7_CBC.csv"),
        ("https://osdr.nasa.gov/geode-py/ws/studies/OSD-575/download?source=datamanager&file=LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv", "LSDS-8_CMP.csv"),
    ],
    "swpc": [("https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json", "integral-protons-7-day.json")],
    "papers": [
        ("https://www.nature.com/articles/s41526-020-00111-x.pdf", "english2020.pdf"),
        ("https://static-content.springer.com/esm/art%3A10.1038%2Fs41526-020-00111-x/MediaObjects/41526_2020_111_MOESM1_ESM.pdf", "english2020_supp1.pdf"),
        ("https://www.nature.com/articles/s41526-023-00256-5.pdf", "sprint2023.pdf"),
    ],
}


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def fetch():
    manifest = {}
    for src, items in FILES.items():
        os.makedirs(f"{RAW}/{src}", exist_ok=True)
        for url, name in items:
            path = f"{RAW}/{src}/{name}"
            if not os.path.exists(path) or os.path.getsize(path) == 0:
                subprocess.run(["curl", "-sSL", "-m", "600", "-A", UA, "-o", path, url], check=True)
            manifest[f"{src}/{name}"] = {"url": url, "sha256": sha(path), "bytes": os.path.getsize(path)}
        sums = f"{RAW}/{src}/SHA256SUMS.txt"
        if os.path.exists(sums):  # PhysioNet publishes checksums: verify them
            for line in open(sums):
                h, f = line.split()
                if os.path.exists(f"{RAW}/{src}/{f}"):
                    assert sha(f"{RAW}/{src}/{f}") == h, f"checksum mismatch: {src}/{f}"
    manifest["_retrieved"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    json.dump(manifest, open(f"{RAW}/manifest.json", "w"), indent=1)
    return manifest["_retrieved"]


def mmash(day):
    z = zipfile.ZipFile(f"{RAW}/mmash/MMASH.zip")
    users = sorted({n.split("/")[1] for n in z.namelist() if n.count("/") == 2 and n.split("/")[1].startswith("user_")}, key=lambda u: int(u.split("_")[1]))
    out = []
    for u in users:
        rd = lambda f: list(csv.DictReader(io.TextIOWrapper(z.open(f"DataPaper/{u}/{f}"))))
        try:
            info, sleep, rr = rd("user_info.csv")[0], rd("sleep.csv"), rd("RR.csv")
        except KeyError:
            continue
        tst = sum(float(s["Total Sleep Time (TST)"]) for s in sleep) / 60
        # night rMSSD: 5-minute windows of successive RR differences between 00:00 and 06:00, artefacts (<0.3 s, >2 s) dropped
        win = defaultdict(list)
        for r in rr:
            hh = int(r["time"].split(":")[0])
            ibi = float(r["ibi_s"])
            if hh < 6 and 0.3 < ibi < 2:
                mm = int(r["time"].split(":")[1])
                win[(r["day"], hh, mm // 5)].append(ibi * 1000)
        vals = []
        for w in win.values():
            d = [b - a for a, b in zip(w, w[1:]) if abs(b - a) < 200]
            if len(d) > 100:
                vals.append((sum(x * x for x in d) / len(d)) ** 0.5)
        if not vals:
            continue
        out.append({"user": u, "sex": "male" if info["Gender"] == "M" else "female", "age": int(float(info["Age"] or 0)),
                    "sleepH": round(tst, 2), "nightRmssdMs": round(st.median(vals), 1), "nightRmssdSdMs": round(st.pstdev(vals), 1), "windows": len(vals)})
    json.dump({
        "source": "MMASH: Multilevel Monitoring of Activity and Sleep in Healthy people (PhysioNet 1.0.0)",
        "license": "Open Data Commons Open Database License v1.0", "retrieved": day,
        "processing": "sleepH = total sleep time of the recorded night. nightRmssdMs = median rMSSD of 5-min windows 00:00–06:00 (artefacts dropped).",
        "users": out,
    }, open(f"{OUT}/mmash_reference.json", "w"), indent=1)
    print("mmash users", len(out))


def inspiration4(day):
    keep = {"HEMOGLOBIN": "lab_hemoglobin", "HEMATOCRIT": "lab_hematocrit", "SODIUM": "lab_sodium", "POTASSIUM": "lab_potassium", "CHLORIDE": "lab_chloride",
            "CARBON DIOXIDE, TOTAL": "lab_total_co2", "GLUCOSE": "lab_glucose", "UREA NITROGEN (BUN)": "lab_bun", "CREATININE": "lab_creatinine", "CALCIUM": "lab_calcium_total"}
    rows = []
    for f, tcol in (("LSDS-7_CBC.csv", "TEST_DATE"), ("LSDS-8_CMP.csv", "timepoint")):
        for r in csv.DictReader(open(f"{RAW}/osdr/{f}")):
            if r["ANALYTE"] in keep:
                rows.append({"metric": keep[r["ANALYTE"]], "analyte": r["ANALYTE"].title(), "subject": r["SUBJECT_ID"], "sex": r["SEX"], "time": r[tcol], "value": float(r["VALUE"]), "unit": r["UNITS"], "range": [r["RANGE_MIN"], r["RANGE_MAX"]]})
    json.dump({
        "source": "NASA OSDR OSD-569 (Complete Blood Count) and OSD-575 (Comprehensive Metabolic Panel), SpaceX Inspiration4, 4 civilian crew, 3-day flight",
        "retrieved": day, "timepoints": "L-92 … L-3 before launch, FD = flight day, R+1 … R+194 after return",
        "rows": rows,
    }, open(f"{OUT}/inspiration4_blood.json", "w"), indent=1)
    print("inspiration4 rows", len(rows), sorted({r["time"] for r in rows}))


def goes(day):
    data = json.load(open(f"{RAW}/swpc/integral-protons-7-day.json"))
    pts = [[int(datetime.fromisoformat(d["time_tag"].replace("Z", "+00:00")).timestamp() * 1000), round(d["flux"], 4)] for d in data if d["energy"] == ">=10 MeV"]
    json.dump({
        "source": "NOAA SWPC GOES primary satellite, integral protons >=10 MeV, 5-minute (services.swpc.noaa.gov/json/goes/primary/)",
        "unit": "pfu", "retrieved": day, "sScale": {"S1": 10, "S2": 100, "S3": 1000, "S4": 10000, "S5": 100000},
        "note": "Environment indicator, not astronaut dose (radiation document).", "points": pts,
    }, open(f"{OUT}/goes_protons.json", "w"), indent=0)
    print("goes points", len(pts), "max", max(p[1] for p in pts))


if __name__ == "__main__":
    d = fetch()
    mmash(d); inspiration4(d); goes(d)

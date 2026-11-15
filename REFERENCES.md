# References

Sources used by the Astronaut Health Monitor (NASA Space Apps Challenge 2026, Spark Team). Every alert limit cites its own source in `src/config/thresholds.json`; this page collects them. License texts: [NOTICE](NOTICE) and [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

## NASA data and resources

1. NASA Open Science Data Repository (OSDR), RadLab Data API: ISS DOSTEL-1 absorbed dose rate, 1–8 April 2022. https://osdr.nasa.gov/ (Cabin screen, measured dose rate).
2. NASA OSDR OSD-569 (Complete Blood Count) and OSD-575 (Comprehensive Metabolic Panel), SpaceX Inspiration4 crew. https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 and https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 (Personal screen, blood values reference).
3. NASA Community Coordinated Modeling Center (CCMC), DONKI: solar energetic particle events. https://ccmc.gsfc.nasa.gov/tools/DONKI/ (Cabin screen).
4. NASA-STD-3001, NASA Space Flight Human-System Standard, Volume 1 (Crew Health) and Volume 2 (Human Factors, Habitability and Environmental Health). https://www.nasa.gov/ochmo/human-systems-standards/ (alert limits).
5. NASA Office of the Chief Health and Medical Officer (OCHMO) technical briefs: OCHMO-TB-004 Carbon Dioxide; OCHMO-TB-050 Spacesuits (2025). https://www.nasa.gov/ochmo/ (cabin CO₂ and suit limits).
6. NASA JSC 67378 (2020). Nutritional Requirements for Exploration Missions up to 365 Days (nutrition targets).
7. NASA Technical Reports Server (https://ntrs.nasa.gov/): 20040088708, 20110010986, 20120007708, 20160013633 (sex differences in spaceflight physiology); 20210024317 (EVA heart rate–metabolic rate model); 20220009964 (EVA metabolic rate classes).
8. NASA Human Research Program, Human System Risk descriptions (hazards behind the alert set).

## Other open data

9. NOAA Space Weather Prediction Center, GOES primary satellite integral proton flux (≥10 MeV), 7 days. https://services.swpc.noaa.gov/json/goes/primary/ (U.S. Government work, public domain).
10. Rossi A. et al. (2020). MMASH: Multilevel Monitoring of Activity and Sleep in Healthy people, version 1.0.0. PhysioNet. DOI 10.13026/cerq-fc86. Open Database License 1.0 (crew night-time HRV baselines).
11. Natural Earth 1:110m land, via world-atlas 2.0.2 (https://github.com/topojson/world-atlas). Public domain (Cabin radiation map).

## 3D body model

12. Human Atlas, open-source anatomy viewer by ashemag: https://github.com/ashemag/human-atlas (MIT License). The 3D body on the Personal screen is a point cloud sampled from the meshes as packaged in this project (`scripts/build_hologram.mjs`).
13. BodyParts3D 4.0, © The Database Center for Life Science (DBCLS), licensed under CC BY 4.0 (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Mitsuhashi N. et al. (2009). BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. https://doi.org/10.1093/nar/gkn613 (source of the Human Atlas meshes; changed here: sampled to a point cloud).

## Literature

14. English K.L. et al. (2020). npj Microgravity (Sprint exercise program on the ISS). DOI 10.1038/s41526-020-00111-x, with Supplementary Tables (exercise plan).
15. Sprint follow-up paper (2023), npj Microgravity (exercise plan).
16. George S.P. et al. (2024). Space radiation measurements during the Artemis I lunar mission. Nature (lunar transit dose peaks).
17. Norsk P., Asmar A., Damgaard M., Christensen N.J. (2015). Fluid shifts, vasodilatation and ambulatory blood pressure reduction during long duration spaceflight. J Physiol. PMC4324706.
18. Mark S. et al. (2014). The impact of sex and gender on adaptation to space. J Womens Health; NASA/NSBRI executive summary, PMC4236030.
19. Freeman R. et al. (2011). Consensus statement on the definition of orthostatic hypotension, neurally mediated syncope and the postural tachycardia syndrome. Clin Auton Res 21:69–72.
20. Waters W.W., Ziegler M.G., Meck J.V. (2002). Postspaceflight orthostatic hypotension occurs mostly in women and is predicted by low vascular resistance. J Appl Physiol.
21. Fortney S.M. et al. (2001). Plasma volume changes in spaceflight. J Exp Biol 204:3209.
22. Task Force of the European Society of Cardiology and the North American Society of Pacing and Electrophysiology (1996). Heart rate variability: standards of measurement, physiological interpretation and clinical use. Eur Heart J 17:354–381.
23. Nunan D., Sandercock G.R.H., Brodie D.A. (2010). A quantitative systematic review of normal values for short-term heart rate variability in healthy adults. Pacing Clin Electrophysiol 33:1407–1417. DOI 10.1111/j.1540-8159.2010.02841.x.
24. Lewis M.J. et al. (2007) (RMSSD falls with exercise effort; used for the effort correction).
25. Kim K.J. et al. (2020). Aerosp Med Hum Perform 91(12):923–931 (inspired CO₂ in the EMU spacesuit).
26. Moran D.S., Shitzer A., Pandolf K.B. (1998). A physiological strain index to evaluate heat stress. Am J Physiol.
27. Buller M.J. et al. (2008). Physiological strain index risk limit (CDC Stacks 210476).
28. Montain S.J., Coyle E.F. (1992). Influence of graded dehydration on hyperthermia and cardiovascular drift during exercise. J Appl Physiol.
29. PMC7200725 (bone loss rate during long-duration flight).

## Team research sources

The research list the team used while writing the planning documents, grouped as the team grouped it (links as collected; descriptions added where the team gave one).

### General

- <https://www.ohsu.edu/sites/default/files/2020-05/ButlerSp20-NASATwinsStudy-Garret-Backleman-Science2019.pdf> (NASA twin study)
- <https://scispace.com/pdf/review-of-nasa-s-evidence-reports-on-human-health-risks-cf651ozgpw.pdf>
- <https://www.nasa.gov/wp-content/uploads/2025/09/hsrb-behavioral-health-risk-record-rev-d-1-web.pdf?emrc=d92de7>
- <https://ntrs.nasa.gov/api/citations/20150000512/downloads/20150000512.pdf>
- <https://newspaceeconomy.ca/wp-content/uploads/2022/11/163533main_iss_med_cl.pdf>
- <https://www.nasa.gov/wp-content/uploads/2020/10/2022-01-05_nasa-std-3001_vol.1_rev._b_final_draft_with_signature_010522.pdf>
- <https://www.researchgate.net/publication/279410570_Principles_of_Clinical_Medicine_for_Space_Flight>
- <https://books.google.co.zm/books?id=tTm6a2EfRo0C&printsec=copyright#v=onepage&q&f=false>
- <https://archive.org/details/clinicaldecision0000unse_r3h7/page/n9/mode/2up>
- <https://www.nature.com/articles/s41526-020-00124-6>
- <https://pubmed.ncbi.nlm.nih.gov/25057582/>
- <https://pubmed.ncbi.nlm.nih.gov/29161391/>
- <https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf>
- <https://elib.dlr.de/206522/1/ME-SBA-2024-George-Berger-et-al-Nature%20634%2C%2048-52_s41586-024-07927-7.pdf>
- <https://www.nasa.gov/missions/artemis/artemis-1/artemis-i-radiation-measurements-validate-orion-safety-for-astronauts/>
- <https://www.researchgate.net/publication/252405981_OLTARIS_an_efficient_web-based_tool_for_analyzing_materials_exposed_to_space_radiation>
- <https://www.researchgate.net/publication/258356742_Space_Environment_Information_System_SPENVIS>
- <https://www.spaceweather.gov/products/goes-proton-flux>
- <https://kauai.ccmc.gsfc.nasa.gov/DONKI/>
- <https://ssd-api.jpl.nasa.gov/doc/horizons.html>
- <https://www.spenvis.oma.be/ecss/e_st_10_04c/ecss_20_01_04.htm>
- <https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf>
- <https://www.nasa.gov/podcasts/houston-we-have-a-podcast/mission-control-crew-health-consoles/>
- <https://ntrs.nasa.gov/api/citations/20080010877/downloads/20080010877.pdf>
- <https://theophthalmologist.com/issues/2026/articles/august/standardizing-sans-in-spaceflight/>
- <https://ntrs.nasa.gov/api/citations/20170009173/downloads/20170009173.pdf>
- <https://www.med.upenn.edu/uep/cognition.html>
- <https://www.eurekalert.org/news-releases/490076>
- <https://pubmed.ncbi.nlm.nih.gov/25197887/>
- <https://ntrs.nasa.gov/api/citations/20140017010/downloads/20140017010.pdf>
- <https://ntrs.nasa.gov/citations/20140003730>
- <https://pmc.ncbi.nlm.nih.gov/articles/PMC4236030/>

### Specific topics

- <https://pmc.ncbi.nlm.nih.gov/articles/PMC7200725/> (bone loss 1)
- <https://ntrs.nasa.gov/api/citations/20180000936/downloads/20180000936.pdf> (SANS)
- <https://pmc.ncbi.nlm.nih.gov/articles/PMC6038331/> (Immune System)
- <https://www.researchgate.net/publication/318234063_Space_Physiology_and_Medicine_From_Evidence_to_Practice> (Space Physiology)
- <https://www.researchgate.net/publication/321594669_Space_Psychology_and_Psychiatry> (Space Psychology and Psychiatry)
- <https://www.nature.com/articles/s41586-024-07639-y> (SOMA)
- <https://pubmed.ncbi.nlm.nih.gov/15125798/> (bone loss 2)
- <https://pubmed.ncbi.nlm.nih.gov/26893033/> (bone loss 3)
- <https://pubmed.ncbi.nlm.nih.gov/19150852/> (bone loss 4)

### Clinical cut-off values

- <https://www.guidelinecentral.com/guideline/3534081/>
- <https://edge.sitecorecloud.io/unichicagomc-81nbqnb3/media/pdfs/adult-pdfs/research/critical_value_list.pdf>
- <https://www.labcorp.com/content/dam/labcorp/drupal/811850_DX_TL_Critical(Panic)Values011924_FINAL.pdf>
- <https://www.mayocliniclabs.com/api/sitecore/TestCatalog/DownloadTestCatalog?testId=9731>
- <https://gpnotebook.com/en-GB/pages/ophthalmology/raised-intraocular-pressure-iop-without-glaucoma>
- <https://pmc.ncbi.nlm.nih.gov/articles/PMC9409720/table/jcm-11-04781-t001/>
- <https://www.pulsetoday.co.uk/clinical-feature/clinical-areas/cardiovascular/ten-top-tips-24-hour-ecgs/>
- <https://fda.innolitics.com/device/K053110>
- <https://www.brownhealth.org/centers-services/laboratories/health-care-provider-resources/critical-values-list>
- <https://www.nasa.gov/ochmo-mtb-003-urinary-health-2/>

### Exercise

- <https://doi.org/10.1038/s41526-020-00111-x>
- <https://doi.org/10.1038/s41526-023-00256-5>
- <https://pubmed.ncbi.nlm.nih.gov/36737441/>
- <https://ntrs.nasa.gov/citations/20090013286>
- <https://ntrs.nasa.gov/api/citations/20090007467/downloads/20090007467.pdf>
- <https://ntrs.nasa.gov/citations/20220019338>
- <https://ntrs.nasa.gov/api/citations/20220019338/downloads/Evidence%20report%20aerobic%20and%20muscle_FINAL%209-21-22%20Pubpress%20accepted_v2.pdf>
- <https://ntrs.nasa.gov/citations/20150008161>
- <https://ntrs.nasa.gov/>
- <https://ntrs.nasa.gov/citations/20040172986>
- <https://pubmed.ncbi.nlm.nih.gov/29924746/>
- <https://pmc.ncbi.nlm.nih.gov/articles/PMC10376710/>
- <https://pubmed.ncbi.nlm.nih.gov/37520819/>
- <https://pmc.ncbi.nlm.nih.gov/articles/PMC9898566/>
- <http://dx.doi.org/10.1007/978-1-4939-6652-3_13>
- <https://doi.org/10.1186/s13728-016-0050-4>
- <https://pubmed.ncbi.nlm.nih.gov/27489615/>
- <https://doi.org/10.1016/j.bone.2019.07.013>
- <https://pubmed.ncbi.nlm.nih.gov/31400472/>
- <https://www.nasa.gov/directorates/esdmd/hhp/muscle-risk/>
- <https://www.danishaerospace.com/en/sprint-vo2max>

### Nutrition

- <https://ntrs.nasa.gov/citations/20205008306> (Nutritional requirements for exploration missions up to 365 days – JSC 67378)
- <https://www.nasa.gov/reference/nasa-std-3001v2/> (NASA human factors, habitability, and environmental health standards – NASA-STD-3001 Volume 2)
- <https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_2> (NASA-STD-3001 Volume 2 official standard record)
- <https://www.nasa.gov/wp-content/uploads/2020/10/2022-04-08_nasa-std-3001_vol_2_rev_c_final.pdf> (NASA-STD-3001 Volume 2 full-text PDF – caloric and EVA energy requirements)
- <https://www.nasa.gov/directorates/esdmd/hhp/human-adaptation-to-spaceflight-the-role-of-food-and-nutrition/> (Human adaptation to spaceflight: the role of food and nutrition – 2nd edition)
- <https://arc.aiaa.org/doi/10.2514/6.IAC-06-A1.2.01> (Nutrition issues for space exploration paper – NTRS 20060049121)
- <https://ntrs.nasa.gov/api/citations/20090029998/downloads/20090029998.pdf> (Clinical nutrition assessment of ISS astronauts PDF)
- <https://www.nasa.gov/wp-content/uploads/2022/03/iss_technical_publication_030116.pdf> (ISS technical publication – clinical nutrition assessment section)
- <https://ntrs.nasa.gov/citations/20140009569> (Challenges of developing a nutritious food system for a Mars mission – NTRS 20140009569)
- <https://ntrs.nasa.gov/api/citations/20140009569/downloads/20140009569.pdf?attachment=true> (Challenges of developing a nutritious food system for a Mars mission full-text PDF)
- <https://ntrs.nasa.gov/citations/20110015912> (Scientific basis for space station nutrition requirements)
- <https://ntrs.nasa.gov/api/citations/20170010125/downloads/20170010125.pdf> (ISS food system, sensory factors, and sodium reduction PDF – NTRS 20170010125)
- <https://ntrs.nasa.gov/citations/20140010665> (Food system development and sodium reduction studies for space exploration – NTRS 20140010665)
- <https://ntrs.nasa.gov/citations/20250006212> (Space food systems overview – NTRS 20250006212)
- <https://ntrs.nasa.gov/api/citations/20250006212/downloads/Space%20Food%20Systems%20Overview%20with%20Coca%20Cola.pdf?attachment=true> (Space food systems overview presentation PDF)
- <https://digital.library.unt.edu/> (UNT Digital Library – NASA food selection and taste panel materials archive)
- <https://www.nasa.gov/ochmo/food-in-space/> (NASA food and nutrition in space overview page)
- <https://www.asc-csa.gc.ca/eng/astronauts/living-in-space/eating-in-space.asp> (Canadian Space Agency – eating in space guide)
- <https://www.nationalacademies.org/publications/11537> (National Academy of Medicine – Dietary Reference Intakes / DRI publication)
- <https://www.nationalacademies.org/read/10490> (Dietary Reference Intakes for energy and macronutrients reading page)
- <https://www.ncbi.nlm.nih.gov/books/NBK222890/> (NCBI Bookshelf – Dietary Reference Intakes and EER equations)
- <https://www.youtube.com/shorts/dx4VnF0LjOs> (Overview of fluid and carbonated beverage consumption in space)

### Radiation

- <https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf> (NASA OCHMO-TB-020 Technical Brief: Design for Ionizing Radiation Protection derived from NASA-STD-3001 Vol 1 & Vol 2)
- <https://www.nasa.gov/wp-content/uploads/2021/09/ochmo_standards_overview_sept_15_2021_francisco.pdf> (OCHMO Human Spaceflight Standards overview presentation by David Francisco, 2021)
- <https://standards.nasa.gov/sites/default/files/standards/NASA/B/Historical/NASA-STD-3001-VOL-1A-Chg1-1.pdf> (NASA-STD-3001 Volume 1, Revision A w/ Change 1: Crew Health historical PDF)
- <https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_1> (NASA Technical Standards System record for NASA-STD-3001 Volume 1)
- <https://ntrs.nasa.gov/api/citations/20170001372/downloads/20170001372.pdf> (NASA Space Radiation Program Element presentation on research strategy, PELs, and tissue reaction limits – NTRS 20170001372)
- <https://nlsp.nasa.gov/resources/lsah> (NASA Lifetime Surveillance of Astronaut Health – LSAH resources and newsletter repository)
- <https://pubmed.ncbi.nlm.nih.gov/12539765/> (PubMed summary of NCRP Report No. 132: Radiation protection guidance for activities in low-Earth orbit)
- <https://ntrs.nasa.gov/api/citations/20050215115/downloads/20050215115.pdf> (NASA technical report detailing NCRP Report No. 132 30-day, annual, and career Gy-Eq and Sv exposure limits)
- <https://www.nationalacademies.org/read/26155/chapter/5> (National Academies Press – Space Radiation and Astronaut Health: Managing and Communicating Cancer Risks, 600 mSv career limit and 3% REID)
- <https://pure.johnshopkins.edu/en/publications/space-radiation-and-astronaut-health-managing-and-communicating-c/> (Publication record for Space Radiation and Astronaut Health – DOI: 10.17226/26155)
- <https://ntrs.nasa.gov/citations/20110015144> (NASA SRAG report: ISS and Space Shuttle Radiation Measurements at Solar Minimum – NTRS 20110015144)
- <https://ntrs.nasa.gov/api/citations/20150016969/downloads/20150016969.pdf?attachment=true> (Calibration and Readiness of the ISS-RAD Charged Particle Detector PDF – NTRS 20150016969)
- <https://pubmed.ncbi.nlm.nih.gov/37945091/> (PubMed record for Results from the Radiation Assessment Detector on the ISS: Part 1, the Charged Particle Detector – DOI: 10.1016/j.lssr.2023.01.003)
- <https://pubmed.ncbi.nlm.nih.gov/37945093/> (PubMed record for Results from the Radiation Assessment Detector on the ISS: Part 3, combined results from the CPD and FND – DOI: 10.1016/j.lssr.2023.06.002)
- <https://www.swsc-journal.org/articles/swsc/full_html/2016/01/swsc160033/swsc160033.html> (DOSIS & DOSIS 3D long-term dose monitoring with DOSTEL instruments onboard the ISS Columbus Laboratory – J. Space Weather Space Clim., 2016)
- <https://www.swsc-journal.org/articles/swsc/abs/2017/01/swsc160046/swsc160046.html> (DOSIS & DOSIS 3D radiation measurements with DOSTEL instruments 2009–2016 – J. Space Weather Space Clim., 2017)
- <https://visualization.osdr.nasa.gov/eda/> (NASA OSDR Environmental Data App – ISS cabin and radiation monitoring telemetry)
- <https://science.nasa.gov/biological-physical/data/osdr/> (NASA Open Science Data Repository – OSDR overview and environmental telemetry)
- <https://ntrs.nasa.gov/api/citations/20240011064/downloads/Kirill_Grigorev-WRMISS2024-presentation-v2.pdf> (RadLab: Comprehensive Database, GUI, and API for Space Radiation Data presentation PDF)
- <https://ntrs.nasa.gov/citations/20240001998> (RadLab component of NASA Open Science Data Repository – NTRS record)
- <https://visualization.osdr.nasa.gov/> (OSDR Visualization Portal featuring RadLab space radiation dosimetry explorer)
- <https://www.swpc.noaa.gov/products/goes-proton-flux> (NOAA Space Weather Prediction Center – GOES Proton Flux and NOAA Solar Radiation Storm S-scale thresholds)
- <https://www.ncei.noaa.gov/products/goes-r-space-environment-in-situ> (NOAA NCEI – GOES-R Space Environment In-Situ Suite / SEISS energetic particle and radiation storm data)
- <https://pmc.ncbi.nlm.nih.gov/articles/PMC10919961/> (PubMed Central full text – System of radiological protection for human spaceflight, GCR and SPE exposure levels)
- <https://www.swsc-journal.org/articles/swsc/full_html/2017/01/swsc160044/swsc160044.html> (J. Space Weather Space Clim. 2017 article featuring Table 1: NASA 30-day Permissible Exposure Limits for lens, skin, BFO, heart, and CNS)

## Software and fonts

React and React DOM (MIT), three.js (MIT), Lucide icons (ISC), B612 and B612 Mono fonts (SIL OFL 1.1), Vite, TypeScript and Vitest (build and test), Electron (MIT, desktop app). Versions and full texts: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

## Team material

- G-TRANSIT v1.1 orthostatic-risk core (`src/core/gtransit/core.js`): the team's own work, made before the event.
- Acute decision tree, version 3: full English translation in [docs/acute-decision-tree-v3.md](docs/acute-decision-tree-v3.md).
- Team planning documents (build order, alarm checklist, acute decision tree v3, EVA panel v2, chart blueprint, periodic health tasks, nutrition, exercise, radiation, route radiation planning, health hexagon data sources, personal baseline, mental health). They are internal working documents written in Turkish and are not published here; Space Apps requires linked material in English. Their content is implemented in `src/config/*.json` with a source note per item.

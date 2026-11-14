# CV import evaluation

On November 13, 2026, Fundlark tested 91 publicly posted researcher CV PDFs across computing, engineering, physical and life sciences, health, economics, social science, and humanities. The sample included students, postdocs, faculty, and research staff. Duplicate versions and application guides were excluded.

| Detection in 90 readable CVs | Prior importer | Updated importer |
| --- | ---: | ---: |
| At least one research topic | 90 | 90 |
| At least one society suggestion | 2 | 13 |
| At least one current institution suggestion | 18 | 70 |
| A single career stage suggestion | 19 | 69 |

Five CVs generated multiple career stage options. One PDF had no usable text. Detection counts measure whether any suggestion appeared; they do not measure accuracy, how many correct fields were missed, or whether a membership remains active. Public copies can be old. Irregular tables, multi-column PDF reading order, and unlabeled or undated entries still need human review.

Public sample sources include [University of British Columbia computing](https://www.cs.ubc.ca/~kevinlb/CV%20%28Leyton-Brown%29.pdf), [Nuremberg University of Technology](https://www.utn.de/files/2026/01/2026_CV_Wolfram_Burgard.pdf), and [University of Oxford economics](https://www.economics.ox.ac.uk/sitefiles/cv-jpcarvalho-aug25.pdf). Locally, `cv/public/corpus.json` lists the source URLs and `cv/public/results.json` has the aggregate and per-file counts. The PDFs, private CVs, and raw extracted text stay outside Git.

To rerun against a local manifest, generate the PDF and DOCX readers with `npm run build:cv`, then run `node scripts/evaluate_cv.mjs cv/public/corpus.json`. A manifest is a JSON array of entries with `file` (relative to the manifest) and `group` labels. The report does not include CV text or suggested profile values.

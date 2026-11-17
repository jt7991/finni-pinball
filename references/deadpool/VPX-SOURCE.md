# VPX source and extraction

The intended source is [JP Salas's Deadpool (Stern 2018)](https://www.vpforums.org/index.php?app=downloads&showfile=15967). On November 16, 2026, the page lists version 7.0.0, 56.4 MB, and "Permission to MOD?: Yes, without approval". The author describes it as a tribute with differences from the physical Stern layout; the reskin must follow the VPX's actual geometry after extraction.

The table was downloaded through the authenticated official download manager and extracted locally. The archive is `source-tables/deadpool-jp-v7.zip`, 53,771,851 bytes. Its SHA-256 is `be87d347e33297bc09dd867142628ac23718a3f14ecbf768f771361a479fbbec`.

The actual toy has four parts: `LilHead`, `LilLeftArm`, `LilRightArm` and static body `Primitive077`. The head and arms have separate animated pivots. The table's script drives their `rotx` and `roty` values in `lilShakeTimer_Timer`. The original Mini Deadpool model is credited by the table's changelog to OneSharpEdge.

The playfield texture is `pf`, 2048 × 4550 pixels, mapped onto a table measuring 952 × 2115 VPX units. Its insert positions and outlines are taken from the extracted `Light.*.json` data.

`scripts/extract-table.ps1 -TablePath <file.vpx>` verifies the table, extracts its embedded assets, and exports its scene to GLB using [vpxtool v0.40.1](https://github.com/francisdb/vpxtool/releases/tag/v0.40.1). The downloaded Windows tool archive was checked against the release's published SHA-256 digest.

Blender 4.5.16 LTS is available locally under `.tools/blender/`. Downloads and extracted third-party table content stay outside version control under `.tools/`, `source-tables/`, and `.work/`.

The earlier `concept-v1` artwork and standalone seated fox are superseded. The current design uses the source toy's upright pose, scale and pivots; costume geometry is replaced with clean fox anatomy. Original pivot matrices are retained in `output/vpx-v1/fox-fit-report.json`.

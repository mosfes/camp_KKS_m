# Automatic upstream sync

`Sync upstream main` merges `yveszangpat/camp:main` into
`mosfes/camp_KKS_m:main` every five minutes on GitHub Actions. GitHub may delay
scheduled runs. It also supports **Actions → Sync upstream main → Run workflow**.
The schedule runs from the default branch, which must remain `main`.

The destination keeps its own commits, including this workflow. There is no
force push or automatic conflict resolution. A merge conflict or concurrent
destination update fails the run without overwriting remote work. Resolve a
conflict manually by merging upstream `main` into destination `main`, then push.
Concurrent updates are retried by the next scheduled run.

The public upstream needs no additional secret. The workflow uses the
destination's built-in `GITHUB_TOKEN` with `contents: write`. Branch protection
or repository/organization policies that prohibit this push must be adjusted by
an administrator. If upstream later changes files under `.github/workflows/`,
GitHub may reject the push because the built-in token cannot update workflows;
merge those changes manually using an authorized account.

Check the Actions tab for failed runs. GitHub can disable scheduled workflows
in public repositories after 60 days without repository activity; re-enable the
workflow in Actions if that occurs. Pushes made with `GITHUB_TOKEN` do not trigger
other push-based GitHub Actions workflows. This workflow synchronizes Git history
and files only; it does not configure deployment or database migrations.

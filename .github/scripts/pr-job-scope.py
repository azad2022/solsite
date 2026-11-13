#!/usr/bin/env python3
import fnmatch
import json
import os
import re
import subprocess
from pathlib import Path

base = os.environ["BASE_SHA"]
head = os.environ["HEAD_SHA"]
repository = os.environ["REPOSITORY"]
head_ref = os.environ["HEAD_REF"]
pr_number = int(os.environ["PR_NUMBER"])
workflow_id = int(os.environ["WORKFLOW_ID"])
job_name = os.environ["JOB_NAME"]
job_id = os.environ["JOB_ID"]
workflow_file = os.environ["WORKFLOW_FILE"]
patterns = json.loads(os.environ["PATH_PATTERNS"])

def git(args):
    return subprocess.check_output(["git", *args], text=True).strip()

def api_json(endpoint):
    return json.loads(subprocess.check_output(["gh", "api", endpoint], text=True))

def job_block(source, wanted_job):
    lines = source.splitlines()
    marker = f"  {wanted_job}:"
    try:
        start = lines.index(marker)
    except ValueError:
        return None
    end = len(lines)
    for index in range(start + 1, len(lines)):
        if re.match(r"^  [A-Za-z0-9_-]+:$", lines[index]):
            end = index
            break
    # needs/if are scheduling gates, not the test/build definition. Ignore them
    # so adding this evidence gate does not invalidate a still-valid PASS.
    normalized = [
        line for line in lines[start:end]
        if not re.match(r"^    (needs|if):", line)
    ]
    return "\n".join(normalized)

def is_ancestor(sha):
    return subprocess.run(
        ["git", "merge-base", "--is-ancestor", sha, head],
        check=False,
    ).returncode == 0

def changed_paths(baseline):
    return git(["diff", "--name-only", f"{baseline}...{head}"]).splitlines()

baseline = base
found_success = False
api_ok = True
try:
    runs = api_json(
        f"repos/{repository}/actions/runs"
        f"?branch={head_ref}&event=pull_request&per_page=100"
    ).get("workflow_runs", [])
    runs.sort(key=lambda item: item.get("created_at", ""), reverse=True)

    for run in runs:
        if int(run.get("workflow_id", 0)) != workflow_id:
            continue
        if not any(
            int(pr.get("number", 0)) == pr_number
            for pr in run.get("pull_requests", [])
        ):
            continue
        jobs = api_json(
            f"repos/{repository}/actions/runs/{int(run['id'])}/jobs?per_page=100"
        ).get("jobs", [])
        if any(
            job.get("name") == job_name
            and job.get("status") == "completed"
            and job.get("conclusion") == "success"
            for job in jobs
        ):
            baseline = run.get("head_sha") or base
            found_success = True
            break
except Exception as error:
    api_ok = False
    print(f"Prior job PASS lookup failed; fail-open and run the job: {error}")

if not api_ok:
    run_job = True
    reason = "GitHub Actions PASS evidence unavailable; fail-open"
    relevant = []
    definition_changed = True
else:
    if not found_success or not is_ancestor(baseline):
        baseline = base
        reason = "no reusable successful job on current history; compare full PR diff"
    else:
        reason = "compare changes since this job's latest successful run"

    try:
        changed = changed_paths(baseline)
        relevant = [
            path for path in changed
            if any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)
        ]
        previous_workflow = git(["show", f"{baseline}:{workflow_file}"])
        current_workflow = Path(workflow_file).read_text(encoding="utf-8")
        definition_changed = (
            job_block(previous_workflow, job_id)
            != job_block(current_workflow, job_id)
        )
        run_job = bool(relevant or definition_changed)
        if relevant:
            reason = "relevant source/test paths changed since prior PASS"
        elif definition_changed:
            reason = "job execution definition changed since prior PASS"
        else:
            reason = "no relevant source/test or job-definition changes since prior PASS"
    except Exception as error:
        run_job = True
        relevant = []
        definition_changed = True
        reason = f"Git diff or job-definition check failed; fail-open: {error}"

with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
    output.write(f"run={'true' if run_job else 'false'}\n")
    output.write(f"baseline_sha={baseline}\n")
    output.write(f"reason={reason.replace(chr(10), ' ')}\n")

print(f"Workflow ID: {workflow_id}; job: {job_name}")
print(f"Prior successful job SHA: {baseline if found_success else 'none; base SHA used'}")
print(f"Relevant changed paths: {relevant}")
print(f"Normalized job definition changed: {definition_changed}")
print(f"Decision: run={'true' if run_job else 'false'}; reason={reason}")

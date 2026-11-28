#!/usr/bin/env bash
# Print Maven Central's maven-metadata.xml for com.ultikits:UltiTools-API on stdout.
#
# One failed request on a CI runner must not turn a version check red, so the
# request is retried. When every attempt fails this exits non-zero and each
# attempt has said why on stderr (curl's exit code and the HTTP status), so the
# next failure can be read from the log instead of guessed at.
#
# Callers must keep treating "no value" as a failure. This helper only makes a
# transient error less likely to reach them; it never invents a value.
#
# Environment (tests override these; CI uses the defaults):
#   CENTRAL_METADATA_URL    the document to fetch
#   CENTRAL_FETCH_ATTEMPTS  total attempts, default 4
#   CENTRAL_FETCH_DELAY     seconds before the second attempt, default 3;
#                           the wait grows by this much after every failure
set -u

url=${CENTRAL_METADATA_URL:-https://repo1.maven.org/maven2/com/ultikits/UltiTools-API/maven-metadata.xml}
attempts=${CENTRAL_FETCH_ATTEMPTS:-4}
delay=${CENTRAL_FETCH_DELAY:-3}

body=$(mktemp)
trap 'rm -f "$body"' EXIT

i=1
while [ "$i" -le "$attempts" ]; do
  rc=0
  : > "$body"
  # -S keeps curl's own error message on stderr; -w prints the status even when -f fails.
  http=$(curl -sSfL --connect-timeout 10 --max-time 30 -o "$body" -w '%{http_code}' "$url") || rc=$?
  if [ "$rc" -eq 0 ] && [ -s "$body" ]; then
    cat "$body"
    exit 0
  fi
  echo "fetch-central-metadata: attempt $i/$attempts failed (curl exit $rc, HTTP ${http:-none})" >&2
  if [ "$i" -lt "$attempts" ]; then
    sleep "$((delay * i))"
  fi
  i=$((i + 1))
done

echo "fetch-central-metadata: no response from $url after $attempts attempts" >&2
exit 1

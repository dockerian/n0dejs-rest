#!/usr/bin/env bash

set -e

main() {
  local re='^[0-9]+$'

  [ -n "$1" ] || (echo "URL is missing"; exit 1;)
  [[ $2 =~ $re ]] || (echo "Second parameter must be time to wait in seconds"; exit 1;)
  local url=$1
  local wait_duration=$2

  local result=$(wait_for $url $wait_duration)
  if [[ "$result" == "0" ]]; then
    echo "Database at $url is available"
    exit 0
  else
    echo "Database at $url is unavailable after $wait_duration seconds"
    exit 1
  fi
}

wait_for() {
  local start_ts=$(date +%s)
  local url=$1
  local wait_duration=$2
  while :
  do
    [ "$(curl -o /dev/null --silent --head --write-out '%{http_code}\n' $url)" == '200' ]
    local result=$?
    local end_ts=$(date +%s)
    local duration=$((end_ts-start_ts))
    if [[ $result -eq 0 || $duration -gt $(($wait_duration-1)) ]]; then
        break
    fi
  sleep 1
  done
  echo $result
}

main "$@"

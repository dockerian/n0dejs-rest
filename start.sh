#!/usr/bin/env bash
set -o pipefail

function main() {
  cmd_start="./tools/wait-for-it.sh ${DB_HOST}:3306 -s -- node $1.js"

  $cmd_start
}

function get_logging_command() {
  log_cmd=''
  log_tag='n0dejs-api'
  if [[ -n "$RECORDER_HOST" && -n "$RECORDER_PORT" ]]; then
    log_cmd='2>&1 | tee >(logger -t ${log_tag} --tcp -n 127.0.0.1 -P 514)'
    mkdir -p /etc/rsyslog.d
    echo "*.* @@${RECORDER_HOST}:${RECORDER_PORT}" > /etc/rsyslog.d/flight-recorder.conf
    service rsyslog start
  fi
  echo $log_cmd
}

main $@

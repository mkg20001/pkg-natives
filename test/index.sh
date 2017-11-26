#!/bin/bash

tmp="/tmp/$$"

mkdir -p $tmp

cd testpkg
  set -e
  npm i
  npm run pkgv -- -t "$(node -e 'process.platform.replace(/[^a-z]/gmi, "")' -p)"
  mv testpkg $tmp/vanilla
  npm run pkg
  mv testpkg $tmp/native
  #tests
  set +e
  cd $tmp
  DEBUG='*' ./vanilla
  ex=$?
  if [ $ex -ne 0 ]; then
    echo "pkg vanilla binary failed. (expected)"
  else
    echo "pkg vanilla was successful. something must be broken..."
    exit 2
  fi
  DEBUG='*' ./native
  ex=$?
  if [ $ex -ne 0 ]; then
    echo "pkg native binary failed."
    exit 2
  else
    echo "pkg native was successful."
  fi
cd ..

rm -rf $tmp

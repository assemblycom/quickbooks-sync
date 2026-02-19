# TEMPORARY FIX: suppress sending tokenId to auth header
yarn patch-assembly-node-sdk

yarn drizzle-kit migrate
next build
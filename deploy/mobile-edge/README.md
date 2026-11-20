# Mobile Edge database template

This empty SQLite file contains the schema of the application's current Edge document store. It contains zero records. To use it, copy it into a new runtime data directory and set ALPR_DATABASE_PROFILE=edge and ALPR_DATA_DB to the copied file on a compatible backend. Keep all runtime data and SQLite sidecar files outside Git. The mobile app connects to the backend over HTTP and does not open this file directly.

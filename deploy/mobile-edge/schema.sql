CREATE TABLE scope_revisions_v1 (
           key TEXT PRIMARY KEY,
           value INTEGER NOT NULL
         ) WITHOUT ROWID;

CREATE TABLE documents_v1 (
           key TEXT PRIMARY KEY,
           scope TEXT NOT NULL,
           collection TEXT NOT NULL,
           id TEXT NOT NULL,
           revision INTEGER NOT NULL,
           deleted INTEGER NOT NULL DEFAULT 0,
           event_at_ms INTEGER,
           plate_key TEXT,
           raw BLOB NOT NULL
         ) WITHOUT ROWID;

CREATE INDEX idx_docs_list
           ON documents_v1(scope, collection, id) WHERE deleted = 0;

CREATE INDEX idx_docs_event
           ON documents_v1(scope, collection, event_at_ms DESC) WHERE deleted = 0;

CREATE INDEX idx_docs_plate
           ON documents_v1(scope, collection, plate_key) WHERE deleted = 0;

CREATE TABLE committed_requests_v1 (
           key TEXT PRIMARY KEY,
           scope TEXT NOT NULL,
           permanent INTEGER NOT NULL DEFAULT 0,
           seq INTEGER NOT NULL,
           raw BLOB NOT NULL
         ) WITHOUT ROWID;

CREATE INDEX idx_req_prune
           ON committed_requests_v1(scope, permanent, seq);

CREATE TABLE transactional_outbox_v1 (
           key TEXT PRIMARY KEY,
           scope TEXT NOT NULL,
           revision INTEGER NOT NULL,
           raw BLOB NOT NULL
         ) WITHOUT ROWID;

CREATE INDEX idx_outbox_prune
           ON transactional_outbox_v1(scope, revision);

CREATE TABLE township_domain_v1 (
           key TEXT PRIMARY KEY,
           scope TEXT NOT NULL,
           collection TEXT NOT NULL,
           site_id TEXT NOT NULL,
           id TEXT NOT NULL,
           revision INTEGER NOT NULL,
           deleted INTEGER NOT NULL DEFAULT 0,
           updated_at_ms INTEGER NOT NULL,
           raw BLOB NOT NULL
         ) WITHOUT ROWID;

CREATE INDEX idx_township_list
           ON township_domain_v1(scope, collection, site_id, id) WHERE deleted = 0;

PRAGMA user_version = 0;

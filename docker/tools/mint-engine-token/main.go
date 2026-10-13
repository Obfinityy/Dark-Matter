// Command mint-engine-token mints a PentAGI API token (JWT) for the Dark
// Matter orchestrator and stores it in the engine's api_tokens table.
//
// It uses PentAGI's own auth package (via a replace directive to
// engine/pentagi/backend) so the signature and claims format always match what
// the engine validates at request time. Run it AFTER the engine has booted at
// least once (boot runs the DB migrations that create api_tokens and the seed
// admin user).
//
// Env: DATABASE_URL, COOKIE_SIGNING_SALT, TENANT_ID (optional).
// Prints the raw token to stdout; all diagnostics go to stderr.
package main

import (
	"database/sql"
	"fmt"
	"os"

	"pentagi/pkg/server/auth"

	_ "github.com/lib/pq"
)

const tokenName = "dark-matter-engine"

// tenYearTTL keeps the orchestrator token effectively non-expiring without
// special-casing TTL=0 (which would make the JWT expire immediately).
const tenYearTTL = uint64(10 * 365 * 24 * 3600)

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "mint-engine-token: "+format+"\n", args...)
	os.Exit(1)
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fail("DATABASE_URL is not set")
	}
	salt := os.Getenv("COOKIE_SIGNING_SALT")
	if salt == "" || salt == "salt" {
		fail("COOKIE_SIGNING_SALT is not set (or is the insecure default); refusing to mint")
	}
	if tenant := os.Getenv("TENANT_ID"); tenant != "" {
		salt = salt + "|tenant|" + tenant // mirrors config.Config.AuthSalt()
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		fail("open database: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fail("ping database: %v (is the engine up? migrations run at engine boot)", err)
	}

	var uid, rid uint64
	var uhash string
	err = db.QueryRow(`
		SELECT id, hash, role_id FROM users
		WHERE mail = 'admin@pentagi.com' AND status = 'active'
	`).Scan(&uid, &uhash, &rid)
	if err != nil {
		fail("seed admin user not found: %v (boot the engine once so migrations run)", err)
	}

	// Revoke any previous orchestrator token so there is exactly one active.
	if _, err := db.Exec(`
		UPDATE api_tokens SET status = 'revoked'
		WHERE user_id = $1 AND name = $2 AND status = 'active' AND deleted_at IS NULL
	`, uid, tokenName); err != nil {
		fail("revoke previous token: %v", err)
	}

	tokenID, err := auth.GenerateTokenID()
	if err != nil {
		fail("generate token id: %v", err)
	}
	claims := auth.MakeAPITokenClaims(tokenID, uhash, uid, rid, tenYearTTL)
	token, err := auth.MakeAPIToken(salt, claims)
	if err != nil {
		fail("sign token: %v", err)
	}

	if _, err := db.Exec(`
		INSERT INTO api_tokens (token_id, user_id, role_id, name, ttl, status)
		VALUES ($1, $2, $3, $4, $5, 'active')
	`, tokenID, uid, rid, tokenName, tenYearTTL); err != nil {
		fail("insert api_tokens row: %v", err)
	}

	fmt.Println(token)
}

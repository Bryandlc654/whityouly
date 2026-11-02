WITH mapping AS (
  SELECT
    '/avatars/' || lpad(n::text, 2, '0') || '.svg' AS old_url,
    '/avatars/' || lpad((25 + ((n - 1) % 12))::text, 2, '0') || '.svg' AS new_url
  FROM generate_series(1, 24) AS n
)
UPDATE "characters" AS c
SET "avatarUrl" = mapping.new_url
FROM mapping
WHERE c."avatarUrl" = mapping.old_url;
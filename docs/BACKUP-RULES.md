# Backup Rules

Standard for every app (approved by Brian, 10/24/2026). Applies to Ranger, SocialSplash, BuilderBrain, Scout, Barnabas, EduAccess.pro and any new app.

1. **Railway disk: keep 2.** Each app keeps only its newest 2 local snapshots on its Railway volume. Older local snapshots are deleted only after the S3 copy is verified (size and checksum).
2. **Daily copy to AWS.** One backup per day goes to AWS S3 bucket `brihow-jsp-backups` (us-east-2, Ohio) through the `nightly-backup` Railway service (8:45 PM CT). App-level jobs may also write to their own buckets.
3. **Keep 15 days in S3.** `nightly-backup` rotates 15 fixed daily slots (`<app>/slot-00` to `slot-14`), so each night overwrites the copy from 15 days earlier. Every backup bucket also carries a lifecycle rule that expires objects after 15 days (16 for slot buckets, as a safety net) and old versions after 1 day.
4. **Verify, then prune.** A local snapshot is never deleted until its S3 copy is confirmed.
5. **Restores** follow each repo's restore runbook. Howie runs restores and practice drills.

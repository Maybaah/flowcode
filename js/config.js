"use strict";
/* flowcode: deployment config.

   The daily leaderboard is optional. Deploy worker/ (see worker/README.md) and
   paste the URL it prints here; leave it empty and the game runs exactly as
   before, with no network calls and no leaderboard UI. */
window.FC_CONFIG = {
  leaderboardApi: "https://flowcode-leaderboard.maybeez.workers.dev",
};

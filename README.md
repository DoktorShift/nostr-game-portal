In this code we have working

- Signup with Nostr Browser Extension and Signing Device (software or Hardware)
- Create new Account and show user to backup his seeds and better use a signing extension to play our games smooth.
- Friend tab with (Favorites | Circles | Friends). Based on NIP-03 Profile data Kind 05
- Profile Data for user Based on NIP-05
- Profile switching and updating whole content to new user.

Database:

We write **without** RLS policies for now all entrys into database.

We have table for

users
followed_npub
friend_circle
friend_circle_member

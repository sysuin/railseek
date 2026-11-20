-- Route alerts watch every train on a station pair and date, instead of one option.
ALTER TABLE alerts ADD COLUMN kind TEXT NOT NULL DEFAULT 'option';
ALTER TABLE alerts ADD COLUMN classes TEXT NOT NULL DEFAULT '';

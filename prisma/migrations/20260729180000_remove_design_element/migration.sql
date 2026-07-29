-- DropTable
-- Removes the Tasarım Kanvası feature entirely (superseded by the Puck-based
-- UI Builder, which has its own separate, unrelated state model and does not
-- persist to this table). MySQL/MariaDB drops a table's own FK constraints
-- (including the self-referencing parent/children relation) as part of the
-- same DROP TABLE statement — no separate constraint-drop step needed, and
-- no other table has a foreign key referencing DesignElement.
DROP TABLE `DesignElement`;

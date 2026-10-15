-- M13: RLS — deny by default; personal vs org isolation

-- Enable RLS on all domain tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname IN (
        'identity', 'platform', 'planning', 'personal',
        'workforce', 'crm', 'finance_personal', 'finance_business', 'collaboration'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.table_name);
  END LOOP;
END $$;

-- Profiles: users see themselves; members can see co-members via memberships
CREATE POLICY profiles_select_self ON identity.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_update_self ON identity.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY personal_spaces_owner ON identity.personal_spaces
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY organizations_member_select ON identity.organizations
  FOR SELECT TO authenticated
  USING (identity.is_org_member(id) OR owner_user_id = auth.uid());

CREATE POLICY organizations_owner_write ON identity.organizations
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR identity.has_org_role(id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (owner_user_id = auth.uid() OR identity.has_org_role(id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY memberships_select ON identity.memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR identity.is_org_member(organization_id));

CREATE POLICY memberships_admin_write ON identity.memberships
  FOR ALL TO authenticated
  USING (identity.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (identity.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY teams_member ON identity.teams
  FOR ALL TO authenticated
  USING (identity.is_org_member(organization_id))
  WITH CHECK (identity.has_org_role(organization_id, ARRAY['owner','admin','project_manager']::public.org_role[]));

CREATE POLICY team_memberships_member ON identity.team_memberships
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM identity.teams t
      WHERE t.id = team_id AND identity.is_org_member(t.organization_id)
    )
  );

CREATE POLICY permissions_read ON identity.permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY role_grants_read ON identity.role_grants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY invitations_admin ON identity.workspace_invitations
  FOR ALL TO authenticated
  USING (identity.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (identity.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]));

-- Scope helper policies for planning
CREATE POLICY projects_access ON planning.projects
  FOR ALL TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  );

CREATE POLICY tasks_access ON planning.tasks
  FOR ALL TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  );

CREATE POLICY calendar_events_access ON planning.calendar_events
  FOR ALL TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  );

CREATE POLICY time_blocks_owner ON planning.time_blocks
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY focus_sessions_owner ON planning.focus_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY focus_interruptions_owner ON planning.focus_interruptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM planning.focus_sessions fs
      WHERE fs.id = focus_session_id AND fs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM planning.focus_sessions fs
      WHERE fs.id = focus_session_id AND fs.user_id = auth.uid()
    )
  );

-- Personal life: owner only
CREATE POLICY life_areas_owner ON personal.life_areas
  FOR ALL TO authenticated
  USING (identity.owns_personal_space(personal_space_id))
  WITH CHECK (identity.owns_personal_space(personal_space_id));

CREATE POLICY goals_access ON personal.goals
  FOR ALL TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  );

CREATE POLICY habits_owner ON personal.habits
  FOR ALL TO authenticated
  USING (identity.owns_personal_space(personal_space_id))
  WITH CHECK (identity.owns_personal_space(personal_space_id));

CREATE POLICY habit_checkins_owner ON personal.habit_checkins
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personal.habits h
      WHERE h.id = habit_id AND identity.owns_personal_space(h.personal_space_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personal.habits h
      WHERE h.id = habit_id AND identity.owns_personal_space(h.personal_space_id)
    )
  );

CREATE POLICY journal_entries_owner ON personal.journal_entries
  FOR ALL TO authenticated
  USING (identity.owns_personal_space(personal_space_id))
  WITH CHECK (identity.owns_personal_space(personal_space_id));

CREATE POLICY journal_revisions_owner ON personal.journal_revisions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM personal.journal_entries je
      WHERE je.id = journal_entry_id AND identity.owns_personal_space(je.personal_space_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personal.journal_entries je
      WHERE je.id = journal_entry_id AND identity.owns_personal_space(je.personal_space_id)
    )
  );

CREATE POLICY notes_access ON personal.notes
  FOR ALL TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  );

-- Personal finance: owner only via book → personal_space
CREATE POLICY personal_finance_books_owner ON finance_personal.personal_finance_books
  FOR ALL TO authenticated
  USING (identity.owns_personal_space(personal_space_id))
  WITH CHECK (identity.owns_personal_space(personal_space_id));

CREATE POLICY finance_accounts_owner ON finance_personal.finance_accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM finance_personal.personal_finance_books b
      WHERE b.id = book_id AND identity.owns_personal_space(b.personal_space_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_personal.personal_finance_books b
      WHERE b.id = book_id AND identity.owns_personal_space(b.personal_space_id)
    )
  );

CREATE POLICY financial_journals_owner ON finance_personal.financial_journals
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM finance_personal.personal_finance_books b
      WHERE b.id = book_id AND identity.owns_personal_space(b.personal_space_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_personal.personal_finance_books b
      WHERE b.id = book_id AND identity.owns_personal_space(b.personal_space_id)
    )
  );

CREATE POLICY financial_postings_owner ON finance_personal.financial_postings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM finance_personal.financial_journals j
      JOIN finance_personal.personal_finance_books b ON b.id = j.book_id
      WHERE j.id = journal_id AND identity.owns_personal_space(b.personal_space_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM finance_personal.financial_journals j
      JOIN finance_personal.personal_finance_books b ON b.id = j.book_id
      WHERE j.id = journal_id AND identity.owns_personal_space(b.personal_space_id)
    )
  );

-- Org-scoped domains
CREATE POLICY crm_accounts_member ON crm.crm_accounts
  FOR ALL TO authenticated
  USING (identity.is_org_member(organization_id))
  WITH CHECK (identity.is_org_member(organization_id));

CREATE POLICY crm_contacts_member ON crm.crm_contacts
  FOR ALL TO authenticated
  USING (identity.is_org_member(organization_id))
  WITH CHECK (identity.is_org_member(organization_id));

CREATE POLICY crm_opportunities_member ON crm.crm_opportunities
  FOR ALL TO authenticated
  USING (identity.is_org_member(organization_id))
  WITH CHECK (identity.is_org_member(organization_id));

CREATE POLICY invoices_finance ON finance_business.invoices
  FOR ALL TO authenticated
  USING (identity.is_org_member(organization_id))
  WITH CHECK (
    identity.has_org_role(organization_id, ARRAY['owner','admin','finance']::public.org_role[])
  );

CREATE POLICY business_expenses_member ON finance_business.business_expenses
  FOR ALL TO authenticated
  USING (identity.is_org_member(organization_id))
  WITH CHECK (identity.is_org_member(organization_id));

CREATE POLICY correlation_rules_owner ON finance_business.finance_correlation_rules
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY correlation_links_owner ON finance_business.finance_correlation_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM finance_business.finance_correlation_rules r
      WHERE r.id = rule_id AND r.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_business.finance_correlation_rules r
      WHERE r.id = rule_id AND r.owner_user_id = auth.uid()
    )
  );

CREATE POLICY notifications_recipient ON platform.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY notification_receipts_recipient ON platform.notification_receipts
  FOR ALL TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY attachments_scope ON platform.attachments
  FOR ALL TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  );

CREATE POLICY comments_scope ON platform.comments
  FOR ALL TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  );

CREATE POLICY workforce_people_member ON workforce.people_resources
  FOR ALL TO authenticated
  USING (identity.is_org_member(organization_id))
  WITH CHECK (identity.is_org_member(organization_id));

CREATE POLICY time_entries_member ON workforce.time_entries
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR identity.has_org_role(organization_id, ARRAY['owner','admin','project_manager']::public.org_role[])
  )
  WITH CHECK (identity.is_org_member(organization_id));

CREATE POLICY knowledge_spaces_access ON collaboration.knowledge_spaces
  FOR ALL TO authenticated
  USING (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  )
  WITH CHECK (
    (scope_type = 'PERSONAL' AND identity.owns_personal_space(scope_id))
    OR (scope_type = 'ORGANIZATION' AND identity.is_org_member(scope_id))
  );

-- Service role bypasses RLS by default in Supabase; NestJS uses service role with app-level policy.

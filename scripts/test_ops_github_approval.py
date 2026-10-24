import unittest
from ops_github_approval import approved_reviewer

SHA = "a"*40
def pr(draft=False, head=SHA):
    return {"state":"open","draft":draft,"base":{"ref":"main"},"head":{"sha":head},"user":{"login":"author"}}
def approval(login="reviewer", state="APPROVED", sha=SHA, association="COLLABORATOR", number=1):
    return {"id":number,"user":{"login":login},"state":state,"commit_id":sha,
            "author_association":association,"submitted_at":"2026-10-25T00:01:00Z"}

class GateTests(unittest.TestCase):
    def test_independent_review(self):
        self.assertEqual(approved_reviewer(pr(),[approval()],SHA,"operator"),"reviewer")
    def test_author_not_allowed(self):
        with self.assertRaises(ValueError):
            approved_reviewer(pr(),[approval(login="author")],SHA,"operator")
    def test_workflow_actor_not_allowed(self):
        with self.assertRaises(ValueError):
            approved_reviewer(pr(),[approval(login="operator")],SHA,"operator")
    def test_draft_not_allowed(self):
        with self.assertRaises(ValueError):
            approved_reviewer(pr(draft=True),[approval()],SHA,"operator")
    def test_old_commit_not_allowed(self):
        with self.assertRaises(ValueError):
            approved_reviewer(pr(),[approval(sha="b"*40)],SHA,"operator")
    def test_outsider_not_allowed(self):
        with self.assertRaises(ValueError):
            approved_reviewer(pr(),[approval(association="NONE")],SHA,"operator")
    def test_changed_review_revokes(self):
        records=[approval(number=1),approval(state="CHANGES_REQUESTED",number=2)]
        with self.assertRaises(ValueError):
            approved_reviewer(pr(),records,SHA,"operator")
    def test_head_mismatch(self):
        with self.assertRaises(ValueError):
            approved_reviewer(pr(head="b"*40),[approval()],SHA,"operator")

if __name__=="__main__":
    unittest.main()

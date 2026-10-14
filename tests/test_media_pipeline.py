import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import collect_media_leads as news

class MediaPipeline(unittest.TestCase):
 def test_title_link_no_event_assertion(self):
  self.assertEqual(news.parse_day("20261014T092300Z"),"2026-10-14")
  self.assertIsNone(news.parse_day("unknown"))
  self.assertTrue(news.KEYWORDS.search("Barcelona pickpocket stole wallet"))
  self.assertEqual(news.ALIASES["巴塞罗那"][0],"barcelona")
 def test_scrub_removes_pii(self):
  self.assertNotIn("a@example.com",news.scrub("someone a@example.com lost wallet"))
  self.assertNotIn("+441234567891",news.scrub("called +441234567891"))

if __name__=="__main__":unittest.main()

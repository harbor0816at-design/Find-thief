import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_public_sources import Meta,clean
from extract_event_candidates import classify

class TestSourcePipeline(unittest.TestCase):
 def test_meta_extraction(self):
  h=Meta();h.feed('<html><head><title>巴黎城市安全提醒</title><meta property="article:published_time" content="2026-09-01T09:00:00Z"><meta name="description" content="旅客注意财物安全"></head></html>')
  self.assertEqual(h.published,'2026-09-01T09:00:00Z')
  self.assertIn('注意财物',h.description)
 def test_only_metadata_cannot_verify_event(self):
  lead={'source_key':'test','url':'https://example.org/notice','status':'metadata_ok','title':'巴黎卢浮宫被偷手机','meta_description':'游客遭窃经历','published_meta':'2026-09-01'}
  match=classify(lead,{'country':'法国','city':'巴黎'})
  self.assertEqual(match['event_status'],'staging_needs_human_review')
  self.assertEqual(match['incident_occurred_on'],None)
  self.assertEqual(match['spot_mentions'],['卢浮宫'])
  self.assertEqual(match['item_mentions'],['手机'])
  self.assertEqual(match['source_published_on'],'2026-09-01')
 def test_tourism_advice_is_not_a_case(self):
  m={'source_key':'test','url':'https://example.org/','status':'metadata_ok','title':'Travel safety tips','meta_description':'Keep valuables secure'}
  self.assertIsNone(classify(m,{'city':'巴黎'}))
 def test_blocked_page_is_not_candidate(self):
  m={'source_key':'test','url':'https://example.org/','status':'robots_disallow','title':'巴黎被偷'}
  self.assertIsNone(classify(m,{'city':'巴黎'}))
 def test_sanitizer_removes_contacts(self):
  self.assertNotIn('a@example.com',clean('email a@example.com'))
if __name__=='__main__':unittest.main()

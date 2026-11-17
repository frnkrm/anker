import unittest
from anker_companion.widgets import dialog_geometry


class DialogGeometryTests(unittest.TestCase):
    def test_centers_on_current_parent(self):
        self.assertEqual((400, 300, 700, 450), dialog_geometry((0, 0, 1920, 1040), (600, 300, 600, 600), (400, 300)))

    def test_negative_monitor_and_large_font_are_bounded(self):
        for scale in (1, 1.5, 2.5):
            w, h, x, y = dialog_geometry((-1920, -200, 0, 840), (-1900, -180, 800, 800), (2200, 1800), scale)
            self.assertGreaterEqual(x, -1920); self.assertGreaterEqual(y, -200)
            self.assertLessEqual(x + w, 0); self.assertLessEqual(y + h, 840)
            self.assertLess(x, 0)

    def test_window_at_edge_stays_on_same_monitor(self):
        w, h, x, y = dialog_geometry((1920, 0, 3200, 720), (3100, 650, 500, 500), (440, 410))
        self.assertGreaterEqual(x, 1920); self.assertLessEqual(x + w, 3200)
        self.assertGreaterEqual(y, 0); self.assertLessEqual(y + h, 720)

    def test_rejects_invalid_sizes(self):
        with self.assertRaises(ValueError):
            dialog_geometry((0, 0, 0, 0), (0, 0, 100, 100), (10, 10))


if __name__ == '__main__':
    unittest.main()

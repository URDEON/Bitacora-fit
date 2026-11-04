"""Validate the real delivery ZIP: python3 tests/package_delivery_test.py [ZIP]."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
import sys
import unittest


DEFAULT_ARCHIVE = Path(__file__).resolve().parents[2] / 'entrega' / 'Bitacora-Fit-Pro-proyecto.zip'
ARCHIVE = Path(sys.argv.pop(1)) if len(sys.argv) > 1 else DEFAULT_ARCHIVE
PREFIX = 'Bitacora-Fit-Pro/'
IMAGE_SUFFIXES = {'.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif'}


class DeliveryMediaProtectionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = ZipFile(ARCHIVE)
        cls.names = cls.bundle.namelist()
        cls.name_set = set(cls.names)

    @classmethod
    def tearDownClass(cls):
        cls.bundle.close()

    def test_private_folder_marker_is_first_and_empty(self):
        self.assertEqual(self.names[0], PREFIX + '.nomedia')
        self.assertEqual(self.bundle.read(self.names[0]), b'')

    def test_nothing_can_hide_media_outside_the_project_folder(self):
        self.assertNotIn('.nomedia', self.name_set)
        for name in self.names:
            self.assertTrue(name.startswith(PREFIX), name)
            self.assertNotIn('..', PurePosixPath(name).parts, name)

    def test_exercise_folder_is_protected_when_copied_separately(self):
        self.assertEqual(self.bundle.read(PREFIX + 'public/exercises/.nomedia'), b'')

    def test_all_archived_images_have_a_media_scanner_marker(self):
        images = [PurePosixPath(name) for name in self.names if PurePosixPath(name).suffix.lower() in IMAGE_SUFFIXES]
        self.assertTrue(images, 'The delivery must preserve the existing app images.')
        for image in images:
            markers = [(parent / '.nomedia').as_posix() for parent in image.parents]
            self.assertTrue(any(marker in self.name_set for marker in markers), str(image))

    def test_zip_has_no_corrupt_members_or_duplicate_paths(self):
        self.assertIsNone(self.bundle.testzip())
        self.assertEqual(len(self.names), len(self.name_set))


if __name__ == '__main__':
    unittest.main()

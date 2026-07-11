import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.urls import reverse

from house_calc.ai_advisor import fallback_house_advice
from house_calc.bot_visuals import build_preview_spec
from house_calc.image_renderer import PREVIEW_STYLE_VERSION, build_render_prompt, ensure_project_preview
from house_calc.layout_utils import estimate_storeys, summarize_room_program
from house_calc.models import CalculationProject
from house_calc.services import build_project_pdf, save_project
from house_calc.utils import calculate_materials


class CalculateMaterialsTests(SimpleTestCase):
    def test_calculate_materials_returns_expected_values(self):
        result = calculate_materials(120)

        self.assertEqual(result["area"], 120)
        self.assertEqual(result["bricks"], 44694)
        self.assertEqual(result["cement"], 22.3)
        self.assertEqual(result["sand"], 66.9)

    def test_calculate_materials_rejects_zero_and_negative_values(self):
        with self.assertRaises(ValueError):
            calculate_materials(0)

        with self.assertRaises(ValueError):
            calculate_materials(-25)


class AiHelpersTests(SimpleTestCase):
    def test_fallback_house_advice_returns_text(self):
        floor_count = estimate_storeys(150, 4)
        advice = fallback_house_advice(150, 4, 2, True, True, False, floor_count)

        self.assertIn("ArchAI Analysis", advice)
        self.assertIn("Roofing", advice)
        self.assertIn("Windows", advice)

    def test_fallback_house_advice_warns_low_bathroom_ratio(self):
        advice = fallback_house_advice(150, 5, 1, False, False, False, floor_count=1)

        self.assertIn("Bathroom Ratio Alert", advice)
        self.assertIn("ratio: 0.20", advice)
        self.assertIn("Consider adding", advice)

    def test_fallback_house_advice_recommends_medium_home_energy_tip(self):
        advice = fallback_house_advice(150, 4, 2, False, False, False, floor_count=1)

        self.assertIn("For a medium-sized home", advice)
        self.assertIn("passive solar design", advice)

    def test_fallback_house_advice_recommends_large_home_energy_tip(self):
        advice = fallback_house_advice(250, 6, 3, False, False, False, floor_count=2)

        self.assertIn("For a large home", advice)
        self.assertIn("zoned HVAC system", advice)

    def test_render_prompt_contains_selected_features(self):
        project = CalculationProject(
            area=180,
            rooms=5,
            bathrooms=2,
            has_pool=True,
            has_garage=True,
            has_terrace=True,
        )

        prompt = build_render_prompt(project)

        self.assertIn("attached modern garage", prompt)
        self.assertIn("covered terrace", prompt)
        self.assertIn("swimming pool", prompt)

    def test_large_project_prompt_uses_multi_story_building(self):
        project = CalculationProject(
            area=1900,
            rooms=9,
            bathrooms=1,
            has_pool=True,
            has_garage=False,
            has_terrace=False,
        )

        prompt = build_render_prompt(project)

        self.assertIn("two-story modern villa", prompt)
        self.assertEqual(estimate_storeys(1900, 9), 2)

    def test_room_program_lists_more_specific_layout(self):
        summary = summarize_room_program(9, 1, False, False)

        self.assertIn("1 ta mehmonxona", summary)
        self.assertIn("yotoqxona", summary)
        self.assertIn("1 ta vanna xonasi", summary)

    def test_preview_spec_changes_for_different_house_profiles(self):
        compact = build_preview_spec(120, 4, 1, False, False, False)
        villa = build_preview_spec(1500, 8, 3, True, True, True)

        self.assertNotEqual(compact["storeys"], villa["storeys"])
        self.assertNotEqual(compact["roof_style"], villa["roof_style"])
        self.assertNotEqual(compact["palette"]["wall"], villa["palette"]["wall"])

    def test_ensure_project_preview_regenerates_old_fallback_cache(self):
        project = SimpleNamespace(pk=42)

        with TemporaryDirectory() as temp_dir:
            preview_dir = Path(temp_dir)
            preview_path = preview_dir / "house-project-42.png"
            meta_path = preview_dir / "house-project-42.json"
            preview_path.write_bytes(b"old-preview")
            meta_path.write_text(json.dumps({"source": "fallback"}), encoding="utf-8")

            with patch("house_calc.image_renderer.PREVIEW_DIR", preview_dir), patch(
                "house_calc.image_renderer.generate_realistic_house_image",
                return_value=(b"new-preview", "fallback"),
            ) as generate_mock:
                path, source = ensure_project_preview(project)
                self.assertEqual(path, preview_path)
                self.assertEqual(source, "fallback")
                self.assertEqual(preview_path.read_bytes(), b"new-preview")
                self.assertEqual(
                    json.loads(meta_path.read_text(encoding="utf-8")),
                    {"source": "fallback", "style_version": PREVIEW_STYLE_VERSION},
                )
                generate_mock.assert_called_once_with(project)


class CalculationProjectTests(TestCase):
    def test_save_project_persists_web_result(self):
        project = save_project(
            area=120,
            source=CalculationProject.SOURCE_WEB,
            user_name='Ali',
            rooms=4,
            bathrooms=2,
            has_pool=True,
            has_garage=True,
            has_terrace=True,
            ai_summary='AI tavsiya matni',
        )

        self.assertEqual(project.area, 120)
        self.assertEqual(project.user_name, 'Ali')
        self.assertEqual(project.source, CalculationProject.SOURCE_WEB)
        self.assertEqual(project.rooms, 4)
        self.assertEqual(project.bathrooms, 2)
        self.assertTrue(project.has_pool)
        self.assertTrue(project.has_garage)
        self.assertTrue(project.has_terrace)
        self.assertEqual(project.ai_summary, 'AI tavsiya matni')
        self.assertEqual(CalculationProject.objects.count(), 1)

    def test_home_view_saves_result_and_redirects_to_dashboard(self):
        response = self.client.post(
            reverse('house_calc:home'),
            {
                'area': 120,
                'user_name': 'Vali',
                'rooms': 4,
                'bathrooms': 2,
                'has_garage': 'on',
                'has_terrace': 'on',
                'has_pool': 'on',
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Loyiha saqlandi")
        self.assertContains(response, "Tanlangan loyiha")
        self.assertContains(response, "44694")
        self.assertContains(response, "4 xona")
        self.assertEqual(CalculationProject.objects.count(), 1)
        self.assertTrue(CalculationProject.objects.first().ai_summary)

    def test_home_view_can_open_selected_project(self):
        project = save_project(
            area=200,
            source=CalculationProject.SOURCE_WEB,
            user_name='Dilnoza',
            rooms=5,
            bathrooms=2,
            has_pool=False,
            has_garage=True,
            has_terrace=False,
            ai_summary='Tanlangan loyiha uchun tavsiya',
        )

        response = self.client.get(reverse('house_calc:home'), {'project': project.pk})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Dilnoza")
        self.assertContains(response, "200 m²")
        self.assertContains(response, "Tanlangan loyiha uchun tavsiya")

    def test_project_pdf_endpoint_returns_pdf(self):
        project = save_project(
            area=100,
            source=CalculationProject.SOURCE_WEB,
            user_name='Test',
            rooms=3,
            bathrooms=1,
            has_pool=False,
            has_garage=False,
            has_terrace=True,
            ai_summary='Sinov AI tavsiya',
        )

        response = self.client.get(reverse('house_calc:project_pdf', args=[project.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))

    def test_project_preview_endpoint_returns_png(self):
        project = save_project(
            area=160,
            source=CalculationProject.SOURCE_WEB,
            user_name='Preview',
            rooms=5,
            bathrooms=2,
            has_pool=True,
            has_garage=True,
            has_terrace=True,
        )

        with TemporaryDirectory() as temp_dir:
            preview_path = Path(temp_dir) / "preview.png"
            preview_path.write_bytes(b"\x89PNG\r\n\x1a\npreview")

            with patch("house_calc.views.ensure_project_preview", return_value=(preview_path, "fallback")):
                response = self.client.get(reverse('house_calc:project_preview', args=[project.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'image/png')
        self.assertTrue(b"".join(response.streaming_content).startswith(b"\x89PNG\r\n\x1a\n"))

"""Regression tests for world and source-bound Compendium symbolic links."""
from __future__ import annotations

from pathlib import Path
import importlib.util
import sys
import unittest

# The project uses a script filename which may contain a hyphen. Import that
# specific file by path instead of assuming it is an importable Python module.
_SOURCE_FILE = Path(__file__).resolve().parents[2] / "tools" / "boa-references.py"
_SPEC = importlib.util.spec_from_file_location("boa_references", _SOURCE_FILE)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError(f"Cannot import BoA reference validator: {_SOURCE_FILE}")
_MODULE = importlib.util.module_from_spec(_SPEC)
# Needed by dataclasses and other runtime annotation introspection.
sys.modules[_SPEC.name] = _MODULE
_SPEC.loader.exec_module(_MODULE)
ReferenceError = _MODULE.ReferenceError
resolve_symbolic_references = _MODULE.resolve_symbolic_references
resolved_document_type = _MODULE.resolved_document_type
validate_reference_sources = _MODULE.validate_reference_sources


class CompendiumReferenceTests(unittest.TestCase):
    def setUp(self):
        self.compatibility = {
            "schemaVersion": 1,
            "verifiedEnvironment": {"modules": {
                "dragonbane-coreset": {"version": "2.2", "required": True},
                "dragonbane-book-of-magic": {"version": "1.0.1", "required": False},
            }},
        }
        self.sources = {
            "schemaVersion": 1,
            "sources": {
                "dragonbane-core": {
                    "packageType": "module",
                    "packageId": "dragonbane-coreset",
                    "required": True,
                },
                "dragonbane-book-of-magic": {
                    "packageType": "module",
                    "packageId": "dragonbane-book-of-magic",
                    "required": False,
                },
            },
        }
        self.references = {
            "schemaVersion": 1,
            "references": {
                "dragonbane-core:spell.undine": {
                    "source": "dragonbane-core",
                    "uuid": "Item.OHBAF6m2OgA1cZin",
                    "documentType": "Item",
                },
                "dragonbane-book-of-magic:spell.hailstorm": {
                    "source": "dragonbane-book-of-magic",
                    "uuid": "Compendium.dragonbane-book-of-magic.items.Item.vW7kcORmnfySnaC8",
                    "documentType": "Item",
                },
                "dragonbane-book-of-magic:spell.conjure": {
                    "source": "dragonbane-book-of-magic",
                    "uuid": "Compendium.dragonbane-book-of-magic.items.Item.5WIDtxhQkHeeeyTg",
                    "documentType": "Item",
                },
            },
        }

    def validate(self):
        return validate_reference_sources(
            self.compatibility, self.sources, self.references
        )

    def test_accepts_world_and_compendium_uuid(self):
        targets = self.validate()
        self.assertEqual(len(targets), 3)
        self.assertEqual(targets["dragonbane-core:spell.undine"].uuid,
                         "Item.OHBAF6m2OgA1cZin")
        self.assertEqual(targets["dragonbane-book-of-magic:spell.hailstorm"].document_type,
                         "Item")
        self.assertEqual(
            resolved_document_type("Compendium.dragonbane-book-of-magic.items.Item.vW7kcORmnfySnaC8"),
            "Item",
        )

    def test_resolves_symbolic_link_to_compendium_uuid(self):
        output = resolve_symbolic_references(
            "@Ref[dragonbane-book-of-magic:spell.conjure]{Conjure}",
            internal_references={},
            external_references=self.validate(),
        )
        self.assertEqual(output,
            "@UUID[Compendium.dragonbane-book-of-magic.items.Item.5WIDtxhQkHeeeyTg]{Conjure}")

    def test_rejects_wrong_compendium_package(self):
        self.references["references"]["dragonbane-book-of-magic:spell.hailstorm"]["uuid"] = (
            "Compendium.dragonbane-coreset.items.Item.vW7kcORmnfySnaC8"
        )
        with self.assertRaisesRegex(ReferenceError, "points to Compendium package"):
            self.validate()

    def test_rejects_incorrect_document_type(self):
        self.references["references"]["dragonbane-book-of-magic:spell.hailstorm"]["documentType"] = "Actor"
        with self.assertRaisesRegex(ReferenceError, "resolves to Item"):
            self.validate()

    def test_rejects_malformed_compendium_uuid(self):
        self.references["references"]["dragonbane-book-of-magic:spell.hailstorm"]["uuid"] = (
            "Compendium.dragonbane-book-of-magic.Item.vW7kcORmnfySnaC8"
        )
        with self.assertRaisesRegex(ReferenceError, "invalid Foundry UUID"):
            self.validate()

    def test_nested_compendium_document_type(self):
        self.references["references"]["dragonbane-book-of-magic:spell.hailstorm"] = {
            "source": "dragonbane-book-of-magic",
            "uuid": (
                "Compendium.dragonbane-book-of-magic.items.Item.vW7kcORmnfySnaC8"
                ".ActiveEffect.0123456789ABCDEF"
            ),
            "documentType": "ActiveEffect",
        }
        self.assertEqual(self.validate()["dragonbane-book-of-magic:spell.hailstorm"].document_type,
                         "ActiveEffect")


if __name__ == "__main__":
    unittest.main()

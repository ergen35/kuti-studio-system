"""Custom generators for specific entity types (characters, assets, etc.)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

from kuti_backend.characters.models import Character


class CharacterImagePrompt(TypedDict):
    """Result of building a character image prompt."""
    prompt: str
    negative_prompt: str
    title: str


@dataclass
class CharacterImageStrategy:
    """Strategy and style for character image generation."""
    strategy: str  # portrait, full_body, concept
    style: str  # realistic, anime, illustration, watercolor
    image_count: int = 1


# Strategy-specific prompt prefixes
STRATEGY_PREFIXES = {
    "portrait": (
        "Professional character portrait, solo figure, centered composition, "
        "detailed face, expressive eyes, dramatic lighting, "
        "character design sheet style, clean background"
    ),
    "full_body": (
        "Full body character illustration, complete figure, standing pose, "
        "detailed outfit, character turnaround style, neutral background"
    ),
    "concept": (
        "Character concept art, atmospheric, scenic background, "
        "dramatic composition, cinematic lighting"
    ),
}

# Art style suffixes
STYLE_SUFFIXES = {
    "realistic": "digital painting, realistic, detailed, 8k, artstation",
    "anime": "anime style, manga illustration, cel shaded, vibrant colors",
    "illustration": "book illustration, stylized, professional art, high quality",
    "watercolor": "watercolor painting, soft colors, artistic, traditional media style",
}


def build_character_image_prompt(
    character: Character,
    strategy: CharacterImageStrategy,
) -> CharacterImagePrompt:
    """Build an image generation prompt from character data.
    
    Args:
        character: The character entity with description, physical traits, etc.
        strategy: Strategy and style configuration for the generation.
        
    Returns:
        Dictionary with prompt, negative_prompt, and title.
    """
    parts: list[str] = []
    
    # Basic description
    if character.description:
        parts.append(character.description.strip())
    
    # Physical description
    if character.physical_description:
        parts.append(f"Physical appearance: {character.physical_description.strip()}")
    
    # Costume elements
    if character.costume_elements_json and len(character.costume_elements_json) > 0:
        costume = ", ".join(character.costume_elements_json[:8])  # Limit to 8 items
        parts.append(f"Wearing: {costume}")
    
    # Color palette hint
    if character.color_palette_json and len(character.color_palette_json) > 0:
        colors = ", ".join(character.color_palette_json[:4])  # Limit to 4 colors
        parts.append(f"Color scheme: {colors}")
    
    # Key traits = personality/mood indicators
    if character.key_traits_json and len(character.key_traits_json) > 0:
        traits = ", ".join(character.key_traits_json[:6])  # Limit to 6 traits
        parts.append(f"Personality: {traits}")
    
    # Build the main prompt
    strategy_prefix = STRATEGY_PREFIXES.get(strategy.strategy, STRATEGY_PREFIXES["portrait"])
    style_suffix = STYLE_SUFFIXES.get(strategy.style, STYLE_SUFFIXES["realistic"])
    
    description = ", ".join(parts) if parts else "A character"
    prompt = f"{strategy_prefix}, {description}, {style_suffix}"
    
    # Build negative prompt based on style
    negative_parts = [
        "blurry",
        "low quality",
        "deformed",
        "extra limbs",
        "duplicate",
        "multiple people",
        "watermark",
        "signature",
        "text",
    ]
    
    if strategy.style == "anime":
        negative_parts.extend(["3d", "photorealistic", "western cartoon"])
    elif strategy.style == "realistic":
        negative_parts.extend(["cartoon", "anime", "drawing"])
    
    negative_prompt = ", ".join(negative_parts)
    
    # Build title based on strategy
    strategy_titles = {
        "portrait": f"{character.name} - Portrait",
        "full_body": f"{character.name} - Full Body",
        "concept": f"{character.name} - Concept Art",
    }
    title = strategy_titles.get(strategy.strategy, f"{character.name} - Image")
    
    return CharacterImagePrompt(
        prompt=prompt,
        negative_prompt=negative_prompt,
        title=title,
    )

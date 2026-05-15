"""Prompt builder for scene-to-manga generation.

This module handles formatting scene content and character information
into prompts suitable for image generation models like GPT Image 2.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from kuti_backend.story.models import Scene
    from kuti_backend.characters.models import Character, CharacterImage
    from kuti_backend.scene_generation.models import SceneGenerationConfig


# =============================================================================
# Default Prompts
# =============================================================================

DEFAULT_MANGA_BW_SYSTEM_PROMPT = """Setup: Page de manga noir et blanc, format imprimé A4 vertical, lecture de droite à gauche. La page doit contenir plusieurs cases de tailles différentes pour créer du rythme narratif. Les cases doivent être bien séparées par des gouttières claires noires. La composition doit guider l'œil du lecteur naturellement de la case en haut à droite vers les cases suivantes en descendant vers la gauche. Ajouter des plans variés, des gros plans émotionnels, des angles dynamiques et des lignes de vitesse si nécessaire. Le dessin doit être encré proprement, avec fort contraste, aplats noirs, hachures, ombres graphiques et expressions faciales marquées. Intégrer les bulles de dialogue et les onomatopées de manière cohérente dans la mise en page. Garder une narration visuelle lisible, énergique et fidèle à une page de manga traditionnelle.

STYLE VISUEL:
- Dessin encré proprement avec fort contraste noir/blanc
- Aplats noirs nets, hachures directionnelles pour ombres et textures
- Expressions faciales marquées et exagérées (style manga classique)
- Lignes de vitesse pour actions dynamiques et mouvement
- Screentones / trames grises pour dégradés et ambiances
- Pas de couleur, uniquement noir, blanc et niveaux de gris

TYPOGRAPHIE:
- Bulles de dialogue: formes variées (ronde standard, cri avec pointes, pensée avec nuage)
- Onomatopées intégrées dans l'action (CLANG!, WHOOSH, BAM!)
- SFX visuels en style manga japonais

CADRAGE:
- Plans variés: gros plans émotionnels, plans moyens, plans larges d'ambiance
- Angles dynamiques: plongée, contre-plongée, cadrage asymétrique
- Respect des règles de continuité spatiale
- Focus sur les yeux et expressions pour transmettre les émotions"""


DEFAULT_MANGA_COLOR_SYSTEM_PROMPT = """Setup: Page de manga couleur, format imprimé A4 vertical, lecture de droite à gauche. La page doit contenir plusieurs cases de tailles différentes pour créer du rythme narratif. Les cases doivent être bien séparées par des gouttières claires. La composition doit guider l'œil du lecteur naturellement de la case en haut à droite vers les cases suivantes en descendant vers la gauche. Ajouter des plans variés, des gros plans émotionnels, des angles dynamiques et des effets visuels. Le dessin doit être de haute qualité avec des couleurs vibrantes, des éclairages bien travaillés, et une ambiance cohérente. Intégrer les bulles de dialogue et les onomatopées de manière cohérente dans la mise en page.

STYLE VISUEL:
- Colorisation de qualité manga/digital painting
- Palette de couleurs harmonieuse et cohérente
- Éclairage et ombres colorées bien travaillés
- Expressions faciales marquées et dynamiques
- Effets spéciaux lumineux pour actions et pouvoirs
- Finitions professionnelles de webtoon/manga moderne

TYPOGRAPHIE:
- Bulles de dialogue: formes variées adaptées au ton (ronde, cri, pensée)
- Onomatopées stylisées avec effets visuels
- Textes intégrés harmonieusement à l'image

CADRAGE:
- Plans cinématographiques variés
- Angles dramatiques et dynamiques
- Composition guidant le regard du lecteur
- Focus sur les moments émotionnels clés"""


# =============================================================================
# Character Summarization
# =============================================================================

def summarize_character(
    character: Character,
    max_length: int = 300,
    include_costume: bool = True,
) -> str:
    """Create a concise summary of a character for prompt injection.
    
    Args:
        character: The character to summarize
        max_length: Maximum length of the summary
        include_costume: Whether to include costume elements
        
    Returns:
        A formatted character summary string
    """
    parts = []
    
    # Name and basic info
    name = character.alias or character.name
    parts.append(f"{name}")
    
    # Physical description
    if character.physical_description:
        phys = character.physical_description[:200].strip()
        parts.append(f"{phys}")
    elif character.description:
        # Fallback to general description
        desc = character.description[:200].strip()
        parts.append(f"{desc}")
    
    # Costume elements
    if include_costume and character.costume_elements_json:
        costume = ", ".join(character.costume_elements_json[:6])
        parts.append(f"Tenue: {costume}")
    
    # Key traits for personality/expression hints
    if character.key_traits_json:
        traits = ", ".join(character.key_traits_json[:3])
        parts.append(f"Traits: {traits}")
    
    summary = "; ".join(parts)
    
    # Truncate if needed
    if len(summary) > max_length:
        summary = summary[:max_length-3].rsplit(" ", 1)[0] + "..."
    
    return summary


def format_character_for_prompt(
    character: Character,
    reference_image: CharacterImage | None = None,
    expression_hint: str = "",
) -> str:
    """Format a single character entry for the scene prompt.
    
    Args:
        character: The character
        reference_image: Optional reference image to include
        expression_hint: Suggested expression for this scene
        
    Returns:
        Formatted character block
    """
    name = character.alias or character.name
    summary = summarize_character(character)
    
    lines = [f"- {name}: {summary}"]
    
    if expression_hint:
        lines.append(f"  Expression demandée: {expression_hint}")
    
    if reference_image:
        # Include reference URL in format that GPT Image 2 can use
        # Note: This would typically be a publicly accessible URL
        lines.append(f"  [Référence visuelle: character/{character.slug}/image/{reference_image.id}]")
    
    return "\n".join(lines)


# =============================================================================
# Scene Content Formatting
# =============================================================================

def format_scene_content(scene: Scene) -> str:
    """Format the scene content for inclusion in the prompt.
    
    This preserves the narrative structure while making it clearer
    for the image generation model to understand.
    
    Args:
        scene: The scene to format
        
    Returns:
        Formatted scene content
    """
    lines = []
    
    # Scene header
    lines.append(f'Scène: "{scene.title}"')
    
    if scene.location:
        lines.append(f"Lieu: {scene.location}")
    
    if scene.summary:
        lines.append(f"Résumé: {scene.summary}")
    
    lines.append("")  # Empty line
    
    # Main content
    if scene.content:
        lines.append("ACTION:")
        
        # Clean up content - preserve paragraph breaks
        content = scene.content.strip()
        
        # Add dialogues formatting if present
        if '"' in content or '"' in content:
            # Try to identify dialogues and format them
            content = _format_dialogues(content)
        
        lines.append(content)
    
    if scene.notes:
        lines.append("")
        lines.append("NOTES DE MISE EN SCÈNE:")
        lines.append(scene.notes)
    
    return "\n".join(lines)


def _format_dialogues(content: str) -> str:
    """Format dialogue sections to make them clearer in prompts.
    
    This helps the model understand where speech bubbles should go.
    """
    # Pattern to match quoted text
    dialogue_pattern = r'[""]([^""]+)[""]'
    
    def replace_dialogue(match: re.Match) -> str:
        text = match.group(1)
        return f'[DIALOGUE: "{text}"]'
    
    return re.sub(dialogue_pattern, replace_dialogue, content)


def extract_character_expressions(content: str) -> dict[str, str]:
    """Try to extract character expressions from scene content.
    
    This is a heuristic that looks for patterns like:
    - "Jean dit avec colère"
    - "Marie, l'air surpris,"
    
    Returns a dict mapping character names to expression hints.
    """
    expressions = {}
    
    # Common emotion words in French
    emotion_indicators = [
        "colère", "furieux", "fâché", "énervé",
        "joie", "heureux", "souriant", "ravi",
        "triste", "déçu", "morose", "abattu",
        "surpris", "étonné", "stupéfait", "abasourdi",
        "peur", "effrayé", "terrifié", "paniqué",
        "déterminé",         "sérieux", "concentré", "farouche",
    ]
    
    # Simple heuristic: look for "name + emotion word" patterns
    # This is basic and can be improved
    for emotion in emotion_indicators:
        # Look for patterns like "name ... emotion" or "emotion ... name"
        pattern = rf'\b(\w+)\b[^.]*?\b{emotion}\b'
        matches = re.finditer(pattern, content, re.IGNORECASE)
        for match in matches:
            name = match.group(1)
            if len(name) > 2:  # Avoid false positives with short words
                expressions[name] = emotion
    
    return expressions


# =============================================================================
# Main Prompt Building
# =============================================================================

def build_scene_prompt(
    scene: Scene,
    config: SceneGenerationConfig,
    characters: list[Character],
    character_images: dict[str, CharacterImage],
    additional_context: str = "",
) -> str:
    """Build the complete prompt for scene manga generation.
    
    This combines:
    1. System prompt (Setup) from config
    2. Scene content formatted
    3. Character summaries with references
    4. Optional additional context
    
    Args:
        scene: The scene to generate from
        config: Generation configuration (contains system prompt)
        characters: List of characters in the scene
        character_images: Dict mapping character slug to their reference image
        additional_context: Any extra context to append
        
    Returns:
        Complete prompt string ready for GPT Image 2
    """
    sections = []
    
    # Section 1: System prompt (Setup)
    if config.system_prompt:
        sections.append(config.system_prompt.strip())
    else:
        # Fallback to default based on color mode
        if config.color_mode == "color":
            sections.append(DEFAULT_MANGA_COLOR_SYSTEM_PROMPT)
        else:
            sections.append(DEFAULT_MANGA_BW_SYSTEM_PROMPT)
    
    sections.append("")  # Empty line separation
    
    # Section 2: Scene content
    sections.append(format_scene_content(scene))
    
    # Section 3: Characters
    if characters:
        sections.append("")
        sections.append("PERSONNAGES PRÉSENTS:")
        
        # Try to extract expression hints from content
        expression_hints = extract_character_expressions(scene.content or "")
        
        for character in characters:
            ref_image = character_images.get(character.slug)
            expression = expression_hints.get(character.name, "") or \
                        expression_hints.get(character.alias or "", "")
            
            char_block = format_character_for_prompt(
                character,
                reference_image=ref_image,
                expression_hint=expression,
            )
            sections.append(char_block)
    
    # Section 4: Additional context
    if additional_context:
        sections.append("")
        sections.append("CONTEXTE ADDITIONNEL:")
        sections.append(additional_context)
    
    # Section 5: Style-specific guidance
    sections.append("")
    sections.append("DIRECTION ARTISTIQUE:")
    
    if config.style_preset == "shonen":
        sections.append("- Style shonen: action dynamique, émotions exagérées, lignes de vitesse marquées")
    elif config.style_preset == "shojo":
        sections.append("- Style shojo: émotions subtiles, grands yeux expressifs, atmosphère romantique/dramatique")
    elif config.style_preset == "seinen":
        sections.append("- Style seinen: réalisme, détails précis, tons plus sombres et matures")
    
    if config.color_mode == "bw":
        sections.append("- Noir et blanc uniquement: fort contraste, hachures, screentones")
    elif config.color_mode == "color":
        sections.append("- Couleur: palette harmonieuse, éclairage soigné, finitions digitales")
    elif config.color_mode == "spot_color":
        sections.append("- Spot color: noir et blanc avec accents de couleur ponctuels")
    
    return "\n\n".join(sections)


def preview_scene_prompt(
    scene: Scene,
    config: SceneGenerationConfig,
    characters: list[Character],
    character_images: dict[str, CharacterImage],
    additional_context: str = "",
) -> dict:
    """Generate a preview of the prompt with metadata.
    
    Returns a dict with:
    - system_prompt: The Setup section
    - scene_section: The Scene section
    - full_prompt: Combined prompt
    - character_summaries: List of character info
    - warnings: Any warnings (missing refs, etc.)
    """
    warnings = []
    
    # Check for missing character images
    for character in characters:
        if character.slug not in character_images:
            warnings.append(
                f"No reference image for character '{character.name}'. "
                "Generation may lack visual consistency."
            )
    
    # Check prompt length (GPT Image 2 has limits)
    full_prompt = build_scene_prompt(
        scene, config, characters, character_images, additional_context
    )
    
    if len(full_prompt) > 4000:
        warnings.append(
            f"Prompt is very long ({len(full_prompt)} chars). "
            "Consider shortening character descriptions."
        )
    
    # Split sections for preview
    system_prompt = config.system_prompt or DEFAULT_MANGA_BW_SYSTEM_PROMPT
    
    scene_section = format_scene_content(scene)
    if characters:
        char_lines = ["PERSONNAGES PRÉSENTS:"]
        for character in characters:
            ref_image = character_images.get(character.slug)
            char_lines.append(format_character_for_prompt(character, ref_image))
        scene_section += "\n\n" + "\n".join(char_lines)
    
    character_summaries = [
        {
            "slug": c.slug,
            "name": c.name,
            "has_reference": c.slug in character_images,
            "summary": summarize_character(c, max_length=150),
        }
        for c in characters
    ]
    
    return {
        "system_prompt": system_prompt,
        "scene_section": scene_section,
        "full_prompt": full_prompt,
        "character_summaries": character_summaries,
        "warnings": warnings,
    }

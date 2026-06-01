---
name: brand-monthly-report
description: Use this skill to draft, rewrite, or refine Chinese brand monthly reports from prior-month templates, charts, screenshots, PDFs, article links, and social or media monitoring exports. Trigger when the task is monthly report writing, section-by-section report drafting, competitor report synthesis, article-brand relevance checks, or converting one-off reporting work into a repeatable format and tone.
---

# Brand Monthly Report

## Overview

Use this skill for brand-side monthly reports that combine:

1. Prior template imitation
2. Chart and table interpretation
3. Article-to-brand relevance checks
4. Competitor content analysis
5. Chinese business writing with fixed section structures

Default output style:

1. Follow the prior template first when the user says to follow the template strictly
2. Optimize structure only when the user explicitly asks for better readability or fuller analysis
3. Keep tone factual and mild; do not overstate problems unless evidence is strong

Read [references/writing-rules.md](references/writing-rules.md) before drafting. Read [references/section-playbook.md](references/section-playbook.md) when writing or revising specific report sections.

## Workflow

### 1. Lock the reporting mode

Determine which of these modes applies:

1. `strict-template`: replicate the prior report's structure closely
2. `template-plus`: keep the template tone but improve readability or structure where needed
3. `evidence-check`: verify whether an article is truly related to a target brand
4. `competitor-analysis`: write case analysis or competitor blocks from PDFs, links, or screenshots

If the user says the template must be followed exactly, stay in `strict-template`.

## 2. Build the evidence set

Treat these as valid inputs:

1. Feishu template links
2. Chart screenshots
3. PDF exports
4. News or article URLs
5. User-provided business context

When a section depends on an external article or page, verify the source before writing. Do not infer brand relevance from URL, title, or platform alone.

## 3. Draft in the correct granularity

Match format to content type:

1. Use short paragraphs for single conclusions
2. Use bullets for peak explanations, ranking takeaways, platform splits, and comparison logic
3. Use tables when the template already uses tables, especially negative-comment summaries
4. Use bold for metrics, dates, brand names, and key findings worth scanning quickly

Do not default to one large block of prose.

## 4. Handle template fidelity

When the template governs the section:

1. Preserve title logic and section order
2. Preserve table schemas
3. Preserve the report's tone and density
4. Change structure only if the user asks for optimization

When optimizing structure, improve readability without losing comparability across months.

## 5. Write section-specific outputs

Use the section rules in [references/section-playbook.md](references/section-playbook.md).

High-priority rules:

1. `2.2 volume trend`: summarize the month, then explain clear peaks; note anomalies if a peak is inflated by mis-entry
2. `2.4 SOV`: use `overall volume summary` plus `competitor comparison`
3. `3.3 word cloud`: validate whether top terms match nail-brand tone before interpreting the cloud
4. `3.4 negative comments`: use the table schema from the prior template, not a timeline
5. `2.5 top competitor content`: use `content analysis` plus `propagation takeaways`
6. `3.8 competitor report`: use repeated competitor blocks so brands remain horizontally comparable

## 6. Run article-brand relevance checks

When the user asks whether an article is related to a brand:

1. Answer directly: `related` / `not related` / `weakly related`
2. State why:
   - direct brand mention
   - product or shade mention
   - image or source credit
   - only generic category mention
3. Distinguish:
   - brand-centered coverage
   - product recommendation within a broader article
   - irrelevant semantic collision such as insects vs. beauty brand

Use this evidence standard before turning an article into report analysis.

## 7. Maintain tone discipline

1. Prefer `fact + light interpretation + restrained conclusion`
2. Avoid harsh criticism unless the user explicitly wants diagnostic language
3. Do not describe non-severe issues as major problems
4. If data quality is questionable, describe it as an anomaly, mixed context, or limited representativeness

## Trigger Examples

This skill should trigger on requests like:

1. "Use last month's template to write this month's brand report"
2. "Here is the chart for section 3.2, draft it in template style"
3. "Is this article really related to OPI"
4. "Turn these competitor PDFs into section 3.8"
5. "Create a reusable monthly brand-report workflow"

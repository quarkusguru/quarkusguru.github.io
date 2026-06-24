# Quarkus Guru Tutorial Style Guide

This document defines the standard structure and style for all technical tutorials on Quarkus Guru.

## Core Principles

1. **Practical Focus**: Every tutorial should solve a real problem with working code
2. **Step-by-Step Approach**: Build knowledge incrementally, each section building on the previous
3. **Complete Examples**: All code must be runnable and complete - no partial snippets
4. **Explanations After Code**: Show the code first, then explain what it does and why
5. **Clear Structure**: Use consistent section numbering and logical flow
6. **Production-Ready**: Include error handling, testing, and best practices

## Standard Tutorial Structure

### 1. Overview (Required)
- **Problem Statement**: What challenge does this solve?
- **Solution Overview**: Brief introduction to the technology/approach
- **Learning Objectives**: What will readers learn? (bullet points)
- **Length**: 2-3 paragraphs

Example:
```markdown
## 1. Overview

In modern cloud-native applications, [describe the problem]. Traditional approaches often [describe limitations].

[Technology/Solution name] addresses these challenges by [describe how]. In this tutorial, we'll explore how to [main objectives].

By the end of this tutorial, you'll understand:
- How to set up [technology] in your project
- [Key concept 1]
- [Key concept 2]
- Best practices for production deployments
```

### 2. TL;DR (Optional but Recommended)
- Quick summary for experienced developers
- Key takeaways in 2-3 sentences
- Links to official documentation

### 3. Prerequisites (Required)
List all requirements before starting:
- **Software versions** (Java, Maven/Gradle, etc.)
- **Required knowledge** (concepts readers should know)
- **Optional tools** (Docker, IDEs, etc.)

Example:
```markdown
## 3. Prerequisites

Before starting this tutorial, ensure you have:

- **Java 17 or later** installed ([download here](https://adoptium.net/))
- **Maven 3.8+** or **Gradle 7+** for dependency management
- Basic understanding of:
  - REST APIs and HTTP methods
  - [Framework] fundamentals
  - [Relevant concepts]

**Optional**:
- Docker for running integration tests
- An IDE with [framework] support
```

### 4. Main Content Sections

#### 4.1. Setup/Installation
- Clear commands for project creation
- Dependency additions with explanations
- Directory structure overview
- Configuration file setup
- Verification steps

#### 4.2. Implementation Sections
For each major concept:

1. **Show Complete Code First**
   ```java
   // Complete, runnable code example
   // Include all imports
   // Include package declarations
   // Include proper annotations
   ```

2. **Explain the Code**
   - Break down key components
   - Explain why certain approaches are used
   - Highlight important details
   - Use numbered lists for step-by-step explanations

3. **Test the Implementation**
   - Provide commands to run/test
   - Show expected output
   - Explain what the output means

#### 4.3. Error Handling (Required for Production Topics)
- Try-catch examples
- Retry strategies
- Timeout handling
- Best practices
- Common pitfalls to avoid

#### 4.4. Testing (Required)
- Unit tests with complete examples
- Integration tests
- Testing frameworks and dependencies
- Mock/stub examples when relevant

#### 4.5. Monitoring/Debugging (For Complex Topics)
- Logging best practices
- Debugging techniques
- Metrics and observability
- Dev tools integration

#### 4.6. Best Practices (Required)
- When to use different approaches
- Design patterns
- Performance considerations
- Security considerations
- Common mistakes to avoid

### 5. Conclusion (Required)
- Summary of what was covered (bullet points)
- Key takeaways
- Next steps for readers
- Further reading links

Example:
```markdown
## [N]. Conclusion

In this tutorial, we explored [technology], covering:

- [Key point 1]
- [Key point 2]
- [Key point 3]
- Best practices for production deployments

[Technology] provides [key benefits], making it an excellent choice for [use cases].

### [N.1]. Next Steps

To deepen your understanding, consider:

- [Advanced topic 1]
- [Advanced topic 2]
- [Advanced topic 3]

### [N.2]. Further Reading

- [Official Documentation](link)
- [Related Guide](link)
- [Specification](link)
```

## Code Style Guidelines

### Java Code
```java
// Always include package declaration
package com.example.project;

// Group imports logically
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

import java.util.Map;

// Use descriptive class names
@ApplicationScoped
public class ExampleResource {

    // Add logging
    private static final Logger LOG = Logger.getLogger(ExampleResource.class);

    // Use dependency injection
    @Inject
    SomeService service;

    // Include proper annotations
    @GET
    @Path("/example")
    public Uni<Response> getExample() {
        LOG.info("Processing request");
        
        // Include error handling
        return service.process()
                .onItem().transform(result -> 
                    Response.ok(result).build()
                )
                .onFailure().recoverWithItem(throwable -> {
                    LOG.error("Error processing request", throwable);
                    return Response.serverError()
                            .entity(Map.of("error", throwable.getMessage()))
                            .build();
                });
    }
}
```

### Configuration Files
```yaml
# Add comments explaining each section
document:
  dsl: 1.0.0  # DSL version
  namespace: com.example  # Logical grouping
  name: exampleWorkflow  # Unique identifier
  version: 0.1.0  # Workflow version
```

### Shell Commands
```shell
# Always show the full command
quarkus create app com.example:project -xrest-jackson

# Show expected output when relevant
# Output: [CREATE] pom.xml
#         [CREATE] src/main/java
```

## Writing Style

### Tone
- **Technical but Accessible**: Explain concepts clearly without oversimplifying
- **Direct and Concise**: Get to the point quickly
- **Helpful**: Anticipate reader questions and address them

### Language
- Use active voice: "We create a class" not "A class is created"
- Use present tense: "The method returns" not "The method will return"
- Use "we" for actions: "Let us create a workflow"
- Use "you" when addressing the reader: "You should ensure..."
- Do not use contractions; write the full form: "cannot" not "can't", "I would" not "I'd", "it is" not "it's", "do not" not "don't", "let us" not "let's"
- Do not use em-dashes (—); use a semicolon, parentheses, or two separate sentences instead
- Do not use a colon to join clauses in prose; write two separate sentences instead. Colons may still introduce a list or a code block

### Formatting
- **Bold** for emphasis on important terms or concepts
- `Code formatting` for class names, methods, variables, commands
- *Italics* sparingly, mainly for introducing new terms
- Use bullet points for lists
- Use numbered lists for sequential steps

### Code Comments
- Add comments to explain non-obvious code
- Don't comment obvious code
- Use comments to highlight important details
- Include TODO comments for incomplete examples (if any)

## Section Transitions

Use clear transitions between sections:

```markdown
Now that we've set up the project, let's create our first workflow.

With the basic implementation complete, we can now add error handling.

Having tested our implementation, let's explore best practices.
```

## Common Patterns

### Introducing New Concepts
1. Brief explanation of what it is
2. Why it's useful/important
3. Show the code
4. Explain the code in detail
5. Show how to test/use it

### Comparing Approaches
```markdown
**Use Approach A when:**
- Condition 1
- Condition 2

**Use Approach B when:**
- Condition 1
- Condition 2
```

### Showing Alternatives
```markdown
### Option 1: Using YAML

[Code example]

### Option 2: Using Java

[Code example]

Both approaches achieve the same result, but [explain differences and when to use each].
```

## Quality Checklist

Before publishing, verify:

- [ ] All code examples are complete and runnable
- [ ] All imports and package declarations are included
- [ ] Error handling is demonstrated
- [ ] Testing examples are provided
- [ ] Best practices section is included
- [ ] Conclusion summarizes key points
- [ ] All links are working
- [ ] Code formatting is consistent
- [ ] Section numbering is correct
- [ ] Transitions between sections are smooth
- [ ] Technical accuracy is verified
- [ ] Prerequisites are clearly stated
- [ ] Expected outputs are shown
- [ ] Common pitfalls are addressed
- [ ] No contractions are used (full forms only)
- [ ] No em-dashes are used
- [ ] No colons are used to join clauses in prose (lists and code blocks excepted)

## Examples of Good Practices

### ✅ Good: Complete Code Example
```java
package com.example;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

@Path("/hello")
public class HelloResource {
    @GET
    public String hello() {
        return "Hello World";
    }
}
```

### ❌ Bad: Incomplete Code Example
```java
@GET
public String hello() {
    return "Hello World";
}
```

### ✅ Good: Explanation After Code
```markdown
The `@Path` annotation defines the base URI path for this resource. The `@GET` annotation indicates this method handles HTTP GET requests.
```

### ❌ Bad: Explanation Before Code
```markdown
We need to add annotations to define the path and HTTP method.
[code]
```

### ✅ Good: Specific Prerequisites
```markdown
- **Java 17 or later** installed ([download here](https://adoptium.net/))
- **Maven 3.8+** for dependency management
```

### ❌ Bad: Vague Prerequisites
```markdown
- Java installed
- Build tool
```

## Template

Use this template for new tutorials:

```markdown
---
title: "[Tutorial Title]"
date: YYYY-MM-DD HH:MM:SS +0000
tags: [tag1, tag2, tag3]
description: "[Brief description for SEO]"
toc: true
---

## 1. Overview

[Problem statement and solution overview]

By the end of this tutorial, you'll understand:
- [Learning objective 1]
- [Learning objective 2]
- [Learning objective 3]

## 2. TL;DR

[Quick summary]

## 3. Prerequisites

Before starting this tutorial, ensure you have:

- [Prerequisite 1]
- [Prerequisite 2]

## 4. [Main Topic 1]

[Content]

## 5. [Main Topic 2]

[Content]

## N-2. Error Handling

[Error handling examples and best practices]

## N-1. Testing

[Testing examples]

## N. Best Practices

[Best practices and recommendations]

## N+1. Conclusion

In this tutorial, we explored [summary].

### N+1.1. Next Steps

[Next steps]

### N+1.2. Further Reading

[Links to documentation]
```

## Maintenance

This style guide should be:
- Reviewed quarterly
- Updated based on reader feedback
- Evolved as new patterns emerge
- Referenced for all new tutorials

---

**Last Updated**: 2026-06-24
**Version**: 1.2

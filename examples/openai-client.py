#!/usr/bin/env python3
"""
Example of using the CodeWhisperer proxy with OpenAI Python SDK.

Make sure the proxy server is running:
    npm run dev

Then install OpenAI SDK:
    pip install openai
"""

from openai import OpenAI
import json

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="any-string"  # API key is ignored
)

def example_basic():
    """Basic chat example"""
    print("=== Basic Chat Example ===\n")
    
    response = client.chat.completions.create(
        model="codewhisperer",
        messages=[
            {"role": "user", "content": "Write a Python function to calculate fibonacci numbers"}
        ]
    )
    
    print(response.choices[0].message.content)
    print()

def example_streaming():
    """Streaming chat example"""
    print("=== Streaming Chat Example ===\n")
    
    stream = client.chat.completions.create(
        model="codewhisperer",
        messages=[
            {"role": "user", "content": "Explain what is a binary search tree"}
        ],
        stream=True
    )
    
    for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)
    
    print("\n")

def example_tool_calling():
    """Tool calling example"""
    print("=== Tool Calling Example ===\n")
    
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get the current weather in a given location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "The city and state, e.g. San Francisco, CA"
                        },
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"]
                        }
                    },
                    "required": ["location"]
                }
            }
        }
    ]
    
    # First request - ask about weather
    messages = [
        {"role": "user", "content": "What's the weather like in San Francisco?"}
    ]
    
    response = client.chat.completions.create(
        model="codewhisperer",
        messages=messages,
        tools=tools
    )
    
    message = response.choices[0].message
    print(f"Assistant: {message.content}")
    
    if message.tool_calls:
        print(f"\nTool calls requested:")
        for tool_call in message.tool_calls:
            print(f"  - {tool_call.function.name}")
            print(f"    Arguments: {tool_call.function.arguments}")
            
            # Simulate tool execution
            if tool_call.function.name == "get_weather":
                args = json.loads(tool_call.function.arguments)
                # In real scenario, call actual weather API
                weather_data = {
                    "temperature": 72,
                    "condition": "sunny",
                    "humidity": 45
                }
                
                # Add assistant message and tool response
                messages.append(message)
                messages.append({
                    "role": "tool",
                    "content": json.dumps(weather_data),
                    "tool_call_id": tool_call.id
                })
        
        # Second request - send tool results
        print("\nSending tool results back...\n")
        
        response = client.chat.completions.create(
            model="codewhisperer",
            messages=messages,
            tools=tools
        )
        
        print(f"Final response: {response.choices[0].message.content}")
    
    print()

def example_multi_turn():
    """Multi-turn conversation example"""
    print("=== Multi-turn Conversation Example ===\n")
    
    messages = []
    
    # Turn 1
    messages.append({"role": "user", "content": "What is Python?"})
    response = client.chat.completions.create(
        model="codewhisperer",
        messages=messages
    )
    assistant_msg = response.choices[0].message.content
    messages.append({"role": "assistant", "content": assistant_msg})
    print(f"User: What is Python?")
    print(f"Assistant: {assistant_msg}\n")
    
    # Turn 2
    messages.append({"role": "user", "content": "Can you give me a simple example?"})
    response = client.chat.completions.create(
        model="codewhisperer",
        messages=messages
    )
    assistant_msg = response.choices[0].message.content
    messages.append({"role": "assistant", "content": assistant_msg})
    print(f"User: Can you give me a simple example?")
    print(f"Assistant: {assistant_msg}\n")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        example_name = sys.argv[1]
        if example_name == "basic":
            example_basic()
        elif example_name == "streaming":
            example_streaming()
        elif example_name == "tools":
            example_tool_calling()
        elif example_name == "multi":
            example_multi_turn()
        else:
            print(f"Unknown example: {example_name}")
            print("Available examples: basic, streaming, tools, multi")
    else:
        print("Running all examples...\n")
        example_basic()
        example_streaming()
        example_tool_calling()
        example_multi_turn()

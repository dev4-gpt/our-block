using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using UnityEngine;

// The server owns all inventory, payments, deadlines, navigation and approvals.
public sealed class BlockConnection : MonoBehaviour
{
    public JObject State { get; private set; }
    public string Message { get; private set; } = "Choose a nickname and join your neighborhood.";
    public bool Connected => socket != null && socket.State == WebSocketState.Open;
    public bool Busy { get; private set; }
    readonly ConcurrentQueue<string> incoming = new ConcurrentQueue<string>();
    readonly SemaphoreSlim sendLock = new SemaphoreSlim(1, 1);
    ClientWebSocket socket;
    CancellationTokenSource lifetime;
    string serverKey;

    public async void Connect(string address, string nickname, string code, bool recover)
    {
        if (Busy) return;
        Busy = true;
        try
        {
            lifetime?.Cancel(); socket?.Dispose();
            lifetime = new CancellationTokenSource(); socket = new ClientWebSocket();
            serverKey = "our-block-" + address;
            await socket.ConnectAsync(new Uri(address), lifetime.Token);
            var join = new JObject { ["type"] = "join", ["name"] = nickname, ["code"] = code, ["mode"] = "life" };
            if (recover) { join["code"] = PlayerPrefs.GetString(serverKey + "-code"); join["token"] = PlayerPrefs.GetString(serverKey + "-token"); }
            await SendRaw(join);
            _ = Receive(socket, lifetime.Token);
        }
        catch (Exception ex) { Message = ex.Message; }
        finally { Busy = false; }
    }
    async Task Receive(ClientWebSocket connection, CancellationToken token)
    {
        var buffer = new byte[8192];
        try
        {
            while (!token.IsCancellationRequested && connection.State == WebSocketState.Open)
            {
                using (var stream = new System.IO.MemoryStream())
                {
                    WebSocketReceiveResult result;
                    do
                    {
                        result = await connection.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                        if (result.MessageType == WebSocketMessageType.Close) { incoming.Enqueue("{\"type\":\"error\",\"message\":\"Connection closed. Recover your seat.\"}"); return; }
                        stream.Write(buffer, 0, result.Count);
                        if (stream.Length > 2 * 1024 * 1024) throw new InvalidOperationException("Snapshot exceeds limit.");
                    } while (!result.EndOfMessage);
                    incoming.Enqueue(Encoding.UTF8.GetString(stream.ToArray()));
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) { incoming.Enqueue(new JObject { ["type"] = "error", ["message"] = ex.Message }.ToString()); }
    }
    void Update()
    {
        while (incoming.TryDequeue(out var json))
        {
            try
            {
                var message = JObject.Parse(json);
                switch ((string)message["type"])
                {
                    case "state": State = (JObject)message["state"]; break;
                    case "joined": PlayerPrefs.SetString(serverKey + "-code", (string)message["code"]); PlayerPrefs.SetString(serverKey + "-token", (string)message["token"]); PlayerPrefs.Save(); break;
                    case "result": case "error": Message = (string)message["message"]; break;
                }
            }
            catch (Exception ex) { Message = "Invalid server response: " + ex.Message; }
        }
    }
    public async void Act(string type, JObject fields = null)
    {
        if (!Connected || State == null) { Message = "Connect before acting."; return; }
        var command = fields ?? new JObject();
        command["v"] = 1; command["type"] = type; command["id"] = Guid.NewGuid().ToString("N"); command["revision"] = State["revision"];
        try { await SendRaw(command); } catch (Exception ex) { Message = ex.Message; }
    }
    async Task SendRaw(JObject message)
    {
        await sendLock.WaitAsync();
        try { var bytes = Encoding.UTF8.GetBytes(message.ToString(Newtonsoft.Json.Formatting.None)); await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, lifetime.Token); }
        finally { sendLock.Release(); }
    }
    void OnDestroy() { lifetime?.Cancel(); socket?.Dispose(); lifetime?.Dispose(); }
}

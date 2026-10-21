using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.InputSystem;

public sealed class BlockWorld : MonoBehaviour
{
    public BlockConnection Connection;
    public JObject Content;
    readonly Dictionary<string, Transform> avatars = new Dictionary<string, Transform>();
    readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
    Camera view;
    InputAction move;
    float angle = 35, distance = 55, nextMove;
    Vector3 focus;
    public bool ReducedMotion;

    void Start()
    {
        Application.targetFrameRate = 60;
        var cameraObject = new GameObject("Town camera"); view = cameraObject.AddComponent<Camera>(); view.backgroundColor = new Color(.83f,.89f,.87f); view.clearFlags = CameraClearFlags.SolidColor;
        var sun = new GameObject("Afternoon sun").AddComponent<Light>(); sun.type = LightType.Directional; sun.intensity = 2; sun.transform.rotation = Quaternion.Euler(50,-30,0); sun.shadows = LightShadows.Soft;
        RenderSettings.ambientLight = new Color(.65f,.7f,.63f);
        foreach(var o in Content["worldPlan"]["roads"])PlannedBox(o);
        PlannedBox(Content["worldPlan"]["ground"]);
        foreach(var district in Content["districts"])
        {
            float x=(float)district["x"], z=(float)district["z"]; string color=(string)district["color"];
            Box(new Vector3(x,.1f,z),new Vector3(13,.2f,18),"#cfcea9");
            if((string)district["id"]!="garden")
            {
                foreach(var region in Content["worldPlan"]["regions"])if((string)region["id"]==(string)district["id"])foreach(var o in region["structures"])PlannedBox(o);
                Box(new Vector3(x,.8f,z),new Vector3(4,1.2f,2),"#ac8966");
            }
            else for(int i=0;i<4;i++) { Box(new Vector3(x-3+(i%2)*5,.4f,z-4+(i/2)*5),new Vector3(3,.6f,3),"#8a684f"); Box(new Vector3(x-3+(i%2)*5,.9f,z-4+(i/2)*5),new Vector3(2,.5f,2),"#6f965c"); }
        }
        move = new InputAction("Move", InputActionType.Value);
        move.AddCompositeBinding("2DVector").With("Up","<Keyboard>/w").With("Down","<Keyboard>/s").With("Left","<Keyboard>/a").With("Right","<Keyboard>/d");
        move.AddCompositeBinding("2DVector").With("Up","<Keyboard>/upArrow").With("Down","<Keyboard>/downArrow").With("Left","<Keyboard>/leftArrow").With("Right","<Keyboard>/rightArrow"); move.Enable();
    }
    void PlannedBox(JToken o){var p=o["position"];var s=o["size"];Box(new Vector3((float)p[0],(float)p[1],(float)p[2]),new Vector3((float)s[0],(float)s[1],(float)s[2]),(string)o["color"]);}
    void Box(Vector3 position,Vector3 scale,string color)
    {
        var obj=GameObject.CreatePrimitive(PrimitiveType.Cube);obj.transform.position=position;obj.transform.localScale=scale;
        if(!materials.TryGetValue(color,out var material)){material=new Material(Shader.Find("Universal Render Pipeline/Lit"));ColorUtility.TryParseHtmlString(color,out var c);material.color=c;materials[color]=material;}obj.GetComponent<Renderer>().sharedMaterial=material;
    }
    void Update()
    {
        if(Connection.State==null)return;
        foreach(var p in Connection.State["players"])
        {
            string id=(string)p["id"]; if(!avatars.TryGetValue(id,out var avatar)){var obj=GameObject.CreatePrimitive(PrimitiveType.Capsule);obj.transform.localScale=new Vector3(.7f,.8f,.7f);avatar=obj.transform;avatars[id]=avatar;}
            avatar.gameObject.SetActive((bool)p["online"]);var target=new Vector3((float)p["x"],.9f,(float)p["z"]);avatar.position=ReducedMotion?target:Vector3.Lerp(avatar.position,target,Time.deltaTime*15);
            if(id==(string)Connection.State["you"])
            {
                focus=Vector3.Lerp(focus,target,ReducedMotion?1:Time.deltaTime*4);
                var input=move.ReadValue<Vector2>();if(input.sqrMagnitude>.01f&&Time.unscaledTime>nextMove){nextMove=Time.unscaledTime+.2f;Connection.Act("move",new JObject{["x"]=Mathf.Clamp(target.x+input.x*2,-25,25),["z"]=Mathf.Clamp(target.z-input.y*2,-23,23)});}
            }
        }
        var mouse=Mouse.current;if(mouse!=null&&mouse.position.ReadValue().x>380){if(mouse.rightButton.isPressed)angle+=mouse.delta.ReadValue().x*.2f;distance=Mathf.Clamp(distance-mouse.scroll.ReadValue().y*.03f,12,90);if(mouse.leftButton.wasPressedThisFrame){var ray=view.ScreenPointToRay(mouse.position.ReadValue());if(new Plane(Vector3.up,Vector3.zero).Raycast(ray,out float hit)){var point=ray.GetPoint(hit);Connection.Act("move",new JObject{["x"]=point.x,["z"]=point.z});}}}
        view.transform.position=focus+Quaternion.Euler(48,angle,0)*new Vector3(0,0,-distance);view.transform.LookAt(focus);
    }
    void OnDestroy(){move?.Dispose();foreach(var material in materials.Values)Destroy(material);}
}

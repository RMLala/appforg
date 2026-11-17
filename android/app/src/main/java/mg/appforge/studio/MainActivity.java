package mg.appforge.studio;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AppForgeSecurityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
